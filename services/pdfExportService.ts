// Dynamic imports to avoid blocking initial load
let jsPDFClass: any;
let html2canvasLib: any;

const loadDependencies = async () => {
    if (!jsPDFClass) {
        const jsPDFModule = await import('jspdf');
        jsPDFClass = jsPDFModule.jsPDF;
    }
    if (!html2canvasLib) {
        html2canvasLib = (await import('html2canvas')).default;
    }
};

interface ExportToPDFOptions {
    elementId: string;
    filename: string;
    title?: string;
    orientation?: 'portrait' | 'landscape';
}

export const exportToPDF = async ({
    elementId,
    filename,
    title,
    orientation = 'portrait'
}: ExportToPDFOptions): Promise<void> => {
    // Load dependencies dynamically
    await loadDependencies();

    const element = document.getElementById(elementId);
    if (!element) {
        throw new Error(`Element with id "${elementId}" not found`);
    }

    // Store original styles
    const originalStyles = {
        display: element.style.display,
        backgroundColor: element.style.backgroundColor,
        color: element.style.color
    };

    // Prepare element for export
    element.style.display = 'block';
    element.style.backgroundColor = '#ffffff';
    element.style.color = '#000000';

    try {
        // Wait a bit for styles to apply
        await new Promise(resolve => setTimeout(resolve, 100));

        // Create canvas from HTML element
        const canvas = await html2canvasLib(element, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            windowWidth: element.scrollWidth,
            windowHeight: element.scrollHeight,
            allowTaint: true,
            removeContainer: false
        });

        const imgData = canvas.toDataURL('image/png', 1.0);
        const imgWidth = orientation === 'landscape' ? 297 : 210; // A4 dimensions in mm
        const imgHeight = (canvas.height * imgWidth) / canvas.width;
        const pageHeight = orientation === 'landscape' ? 210 : 297;
        const pageWidth = orientation === 'landscape' ? 210 : 297;

        // Create PDF
        const pdf = new jsPDFClass({
            orientation,
            unit: 'mm',
            format: 'a4'
        });

        // Add title if provided
        let titleHeight = 0;
        if (title) {
            pdf.setFontSize(18);
            pdf.setTextColor(0, 0, 0);
            const titleLines = pdf.splitTextToSize(title, pageWidth - 40);
            let titleY = 15;
            titleLines.forEach((line: string) => {
                pdf.text(line, pageWidth / 2, titleY, { align: 'center' });
                titleY += 7;
            });
            pdf.setFontSize(10);
            pdf.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, pageWidth / 2, titleY + 2, { align: 'center' });
            titleHeight = titleY + 8;
        }

        let heightLeft = imgHeight;
        let position = title ? titleHeight : 10;
        const margin = 10;
        const contentWidth = pageWidth - (margin * 2);

        // Add first page
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
        heightLeft -= (pageHeight - position - margin);

        // Add additional pages if needed
        while (heightLeft > 0) {
            position = -(imgHeight - heightLeft);
            pdf.addPage();
            pdf.addImage(imgData, 'PNG', margin, position, contentWidth, imgHeight);
            heightLeft -= (pageHeight - margin);
        }

        // Save PDF
        pdf.save(filename);
    } catch (error) {
        console.error('Error generating PDF:', error);
        throw error;
    } finally {
        // Restore original styles
        element.style.display = originalStyles.display;
        element.style.backgroundColor = originalStyles.backgroundColor;
        element.style.color = originalStyles.color;
    }
};

export const exportReportToPDF = async (
    reportElement: HTMLElement,
    filename: string,
    title?: string
): Promise<void> => {
    // Create a temporary container for the report
    const tempContainer = document.createElement('div');
    tempContainer.id = 'pdf-export-container';
    tempContainer.style.position = 'absolute';
    tempContainer.style.left = '-9999px';
    tempContainer.style.top = '0';
    tempContainer.style.width = '210mm'; // A4 width
    tempContainer.style.backgroundColor = '#ffffff';
    tempContainer.style.padding = '20px';
    
    // Clone the report element
    const clonedElement = reportElement.cloneNode(true) as HTMLElement;
    tempContainer.appendChild(clonedElement);
    document.body.appendChild(tempContainer);

    try {
        await exportToPDF({
            elementId: 'pdf-export-container',
            filename,
            title,
            orientation: 'portrait'
        });
    } finally {
        // Clean up
        document.body.removeChild(tempContainer);
    }
};
