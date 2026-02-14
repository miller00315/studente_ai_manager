
import { GoogleGenAI, Type, FunctionDeclaration, Tool, Schema } from "@google/genai";
import { AIQuestionParams, Question, AnalyzedSheet } from "../types";

// --- CONSTANTS & SYSTEM PROMPTS ---

// User requested speed and simple responses.
// Using gemini-2.5-flash-lite for consistency with Android apps
const DEFAULT_MODEL = "gemini-2.5-flash-lite";

const QUESTION_GEN_SYS_PROMPT = `Você é um especialista em criação de conteúdo educacional. 
Seu objetivo é gerar questões de múltipla escolha de alta qualidade em Português do Brasil (pt-BR).
Cada questão deve ter exatamente 5 opções, rotuladas A, B, C, D, E.
Exatamente uma opção deve ser a correta.`;

const VISION_SYS_PROMPT = `Você é um assistente de Reconhecimento Óptico de Caracteres (OCR) especializado em ler cartões de resposta acadêmicos. 
Seu trabalho é extrair o ID da Prova (Test ID), o Nome do Aluno e as respostas marcadas na imagem fornecida.

INSTRUÇÕES CRÍTICAS:
1. TEST ID: Procure um código QR. Ele contém um objeto JSON como {"t_id": "UUID", "ver": 1}. Extraia o valor "t_id". Se nenhum código QR for encontrado ou legível, procure uma string UUID de 36 caracteres.
2. NOME DO ALUNO: Procure o texto manuscrito na caixa "Nome do Aluno" ou "Student Name".
3. RESPOSTAS: Identifique a bolha marcada para cada questão numerada. As opções são tipicamente A, B, C, D, E.`;

// --- CLIENT FACTORY ---

const getAIClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("A chave da API está faltando nas variáveis de ambiente.");
  }
  return new GoogleGenAI({ apiKey });
};

// --- CORE AGENT RUNTIME ---

/**
 * A lightweight Agent Runtime.
 * Simpler is faster. We avoid complex chain logic here.
 */
export const chatWithAgent = async (
    agentName: string, 
    systemPrompt: string, 
    retrievedContext: string, 
    history: any[], 
    message: string,
    toolDeclarations?: FunctionDeclaration[]
) => {
    const ai = getAIClient();

    // 1. Construct the comprehensive system instruction (The "Brain")
    // Note: We intentionally ignore `retrievedContext` as requested to disable RAG/DB lookups.
    const fullSystemInstruction = `ROLE: ${agentName}\n\n${systemPrompt}\n\nResponda sempre em Português do Brasil.`;
    
    // 3. Configure Tools (The "Hands")
    const tools: Tool[] | undefined = toolDeclarations && toolDeclarations.length > 0 
        ? [{ functionDeclarations: toolDeclarations }] 
        : undefined;

    try {
        const chat = ai.chats.create({
            model: DEFAULT_MODEL,
            config: {
                systemInstruction: fullSystemInstruction,
                temperature: 0.7, // Balanced creativity
                tools: tools,
            },
            history: history
        });

        // 4. Send Message
        const result = await chat.sendMessage({ message });
        
        // 5. Return Text directly
        // We use .text property directly as per Google GenAI SDK best practices
        return result.text || "Desculpe, não consegui gerar uma resposta.";
    } catch (error) {
        throw error;
    }
}

// --- SPECIALIZED USE CASES ---

export const generateQuestionsWithAI = async (params: AIQuestionParams): Promise<Partial<Question>[]> => {
  const ai = getAIClient();

  let prompt = `Gere ${params.count} questões de múltipla escolha.
    Público Alvo: Alunos do ${params.gradeLevelName}.
    Dificuldade: ${params.difficulty === 'Easy' ? 'Fácil' : params.difficulty === 'Medium' ? 'Médio' : 'Difícil'}.
    Inclua exatamente 5 opções por questão (A, B, C, D, E).
    Identifique a opção correta usando uma flag booleana.
    O idioma deve ser Português do Brasil.
    Retorne o resultado como um array JSON estruturado.`;

  if (params.sourceText) {
    if (params.topic) {
        prompt += `\n\nInstruções: ${params.topic}`;
    }
    const truncatedText = params.sourceText.substring(0, 30000);
    prompt += `\n\nIMPORTANTE: Gere as questões ESTRITAMENTE baseadas no seguinte contexto. Não use conhecimento externo.\n\nCONTEXTO:\n${truncatedText}`;
  } else {
    prompt += `\nTema: "${params.topic}"`;
  }

  // Schema Definition for strict JSON output
  const responseSchema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        content: { type: Type.STRING, description: "O enunciado da questão" },
        difficulty: { type: Type.STRING, description: "Nível de dificuldade (Easy, Medium, Hard)" },
        grade_level: { type: Type.STRING, description: "Série escolar alvo" },
        subject: { type: Type.STRING, description: "Matéria da questão" },
        question_options: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              content: { type: Type.STRING, description: "Texto da opção" },
              is_correct: { type: Type.BOOLEAN, description: "True se for a resposta correta" },
              key: { type: Type.STRING, description: "O rótulo da opção (A, B, C, D ou E)" }
            },
            required: ["content", "is_correct", "key"]
          },
          description: "Lista de opções de resposta"
        }
      },
      required: ["content", "difficulty", "grade_level", "subject", "question_options"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: prompt,
      config: {
        systemInstruction: QUESTION_GEN_SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    if (response.text) {
      const data = JSON.parse(response.text);
      return data as Partial<Question>[];
    }
    return [];
  } catch (error) {
    throw error;
  }
};

export const analyzeAnswerSheet = async (base64Image: string): Promise<AnalyzedSheet> => {
  const ai = getAIClient();

  const prompt = `Analise esta imagem de um cartão de respostas. 
  Extraia os seguintes dados em uma estrutura JSON limpa:
  - test_id: O UUID extraído do QR code (JSON: t_id) ou texto impresso.
  - student_name: O texto encontrado na área do nome do aluno.
  - answers: Um array de objetos com question_number e selected_option (A-E).`;

  const responseSchema: Schema = {
    type: Type.OBJECT,
    properties: {
      test_id: { type: Type.STRING, description: "O UUID da prova" },
      student_name: { type: Type.STRING, description: "O nome do aluno" },
      answers: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question_number: { type: Type.INTEGER, description: "Índice da questão" },
            selected_option: { type: Type.STRING, description: "Letra selecionada" }
          },
          required: ["question_number", "selected_option"]
        }
      }
    },
    required: ["test_id", "student_name", "answers"]
  };

  try {
    const response = await ai.models.generateContent({
      model: DEFAULT_MODEL,
      contents: {
        parts: [
          { inlineData: { mimeType: "image/jpeg", data: base64Image } },
          { text: prompt }
        ]
      },
      config: {
        systemInstruction: VISION_SYS_PROMPT,
        responseMimeType: "application/json",
        responseSchema: responseSchema
      }
    });

    if (response.text) {
      return JSON.parse(response.text) as AnalyzedSheet;
    }
    throw new Error("Resposta vazia da IA");
  } catch (error) {
    throw error;
  }
};

export const embedText = async (text: string): Promise<number[]> => {
    if (!text || !text.trim()) return [];
    
    const ai = getAIClient();

    // 1. Try SDK (modern model)
    try {
        const response = await ai.models.embedContent({
            model: "text-embedding-004",
            contents: { parts: [{ text: text }] }
        });
        if (response.embeddings?.[0]?.values) return response.embeddings[0].values;
    } catch {
        // try next method
    }

    // 2. Try REST API v1beta (Force modern model if SDK mapped to v1)
    try {
        const apiKey = process.env.API_KEY;
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${apiKey}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: { parts: [{ text }] } })
        });
        if (response.ok) {
            const data = await response.json();
            if (data.embedding?.values) return data.embedding.values;
        }
    } catch {
        // try next method
    }

    // 3. Fallback to SDK (legacy model)
    try {
        const response = await ai.models.embedContent({
            model: "embedding-001",
            contents: { parts: [{ text: text }] }
        });
        if (response.embeddings?.[0]?.values) return response.embeddings[0].values;
    } catch {
        // try keyword search
    }

    // 4. Final Fallback: Keyword Search (Empty Vector)
    return [];
}

const BNCC_EXTRACTION_SYS_PROMPT = `Você é um especialista em análise de documentos educacionais da Base Nacional Comum Curricular (BNCC) do Brasil.
Seu objetivo é identificar e extrair competências e habilidades da BNCC presentes em documentos PDF.

A BNCC possui códigos alfanuméricos específicos (ex: EF01MA01, EF02LP01, EF03CI01) que identificam habilidades.
Cada habilidade possui:
- Código alfanumérico (obrigatório)
- Componente curricular (ex: Matemática, Língua Portuguesa, Ciências)
- Ano/série (ex: 1º Ano, 2º Ano)
- Unidade temática (opcional)
- Descrição da habilidade

INSTRUÇÕES:
1. Analise o conteúdo do documento fornecido
2. Identifique TODAS as competências e habilidades da BNCC mencionadas
3. Se o documento NÃO contém informações sobre BNCC, retorne um array vazio e uma mensagem explicativa
4. Extraia os dados de forma estruturada e precisa
5. Um documento pode conter uma ou múltiplas habilidades BNCC`;

export interface ExtractedBNCC {
    codigo_alfanumerico: string;
    componente_curricular?: string;
    descricao_habilidade?: string;
    ano_serie?: string;
    unidade_tematica?: string;
}

export interface BNCCExtractionResult {
    bnccs: ExtractedBNCC[];
    message?: string;
    hasBNCCContent: boolean;
}

export const extractBNCCsFromPDF = async (pdfText: string): Promise<BNCCExtractionResult> => {
    const ai = getAIClient();

    const prompt = `Analise o seguinte conteúdo extraído de um documento PDF e identifique todas as competências e habilidades da BNCC (Base Nacional Comum Curricular) presentes.

IMPORTANTE:
- Se o documento NÃO contém informações relacionadas à BNCC, retorne um array vazio de bnccs e uma mensagem explicando que o conteúdo não tem relação com BNCC
- Se encontrar habilidades BNCC, extraia TODAS elas, mesmo que sejam múltiplas
- Procure por códigos alfanuméricos da BNCC (formato: EF##XX##, onde ## são números e XX são letras)
- Extraia também o componente curricular, ano/série, unidade temática e descrição quando disponíveis

CONTEÚDO DO DOCUMENTO:
${pdfText.substring(0, 100000)}`;

    const responseSchema: Schema = {
        type: Type.OBJECT,
        properties: {
            bnccs: {
                type: Type.ARRAY,
                items: {
                    type: Type.OBJECT,
                    properties: {
                        codigo_alfanumerico: { type: Type.STRING, description: "Código alfanumérico da habilidade BNCC (ex: EF01MA01)" },
                        componente_curricular: { type: Type.STRING, description: "Componente curricular (ex: Matemática, Língua Portuguesa)" },
                        descricao_habilidade: { type: Type.STRING, description: "Descrição completa da habilidade" },
                        ano_serie: { type: Type.STRING, description: "Ano ou série (ex: 1º Ano, 2º Ano)" },
                        unidade_tematica: { type: Type.STRING, description: "Unidade temática (opcional)" }
                    },
                    required: ["codigo_alfanumerico"]
                },
                description: "Array de habilidades BNCC encontradas no documento"
            },
            hasBNCCContent: { type: Type.BOOLEAN, description: "True se o documento contém conteúdo relacionado à BNCC" },
            message: { type: Type.STRING, description: "Mensagem explicativa caso não haja conteúdo BNCC" }
        },
        required: ["bnccs", "hasBNCCContent"]
    };

    try {
        const response = await ai.models.generateContent({
            model: DEFAULT_MODEL,
            contents: prompt,
            config: {
                systemInstruction: BNCC_EXTRACTION_SYS_PROMPT,
                responseMimeType: "application/json",
                responseSchema: responseSchema,
                temperature: 0.3
            }
        });

        if (response.text) {
            const data = JSON.parse(response.text) as BNCCExtractionResult;
            return data;
        }
        
        return { bnccs: [], hasBNCCContent: false, message: "Não foi possível processar o documento." };
    } catch (error) {
        throw error;
    }
};
