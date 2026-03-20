"""
Documents Router - Serves compliance documents as PDFs
Uses fpdf2 for PDF generation (pure Python, no system dependencies)
"""
import os
import logging
from io import BytesIO
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, JSONResponse
import markdown
from fpdf import FPDF
from html.parser import HTMLParser
import re

router = APIRouter(prefix="/documents", tags=["documents"])
logger = logging.getLogger(__name__)

# Path to compliance documents - use relative path from backend folder
DOCS_PATH = Path(__file__).parent.parent / "docs" / "compliance"

# Available documents mapping
DOCUMENTS = {
    "ROPA": "ROPA.md",
    "BACP_COMPLIANCE": "BACP_ETHICAL_FRAMEWORK_COMPLIANCE.md",
    "GDPR_AUDIT": "GDPR_AUDIT_REPORT.md",
    "INCIDENT_RESPONSE": "INCIDENT_RESPONSE_PLAN.md",
    "SECURITY_SCHEDULE": "SECURITY_REVIEW_SCHEDULE.md",
    "SAFEGUARDING": "SAFEGUARDING_DISCLAIMER.md",
}


def sanitize_text(text: str) -> str:
    """Remove or replace special characters that fpdf2 can't handle with built-in fonts"""
    replacements = {
        '•': '-',
        '–': '-',
        '—': '-',
        '"': '"',
        '"': '"',
        ''': "'",
        ''': "'",
        '…': '...',
        '©': '(c)',
        '®': '(R)',
        '™': '(TM)',
        '×': 'x',
        '→': '->',
        '←': '<-',
        '✓': '[x]',
        '✗': '[ ]',
        '★': '*',
        '☆': '*',
        '\u00a0': ' ',  # Non-breaking space
    }
    for char, replacement in replacements.items():
        text = text.replace(char, replacement)
    # Remove any remaining non-ASCII characters
    text = text.encode('ascii', 'replace').decode('ascii')
    return text


class HTMLtoPDFParser(HTMLParser):
    """Simple HTML parser that extracts text for PDF generation"""
    
    def __init__(self):
        super().__init__()
        self.elements = []
        self.current_tag = None
        self.current_text = ""
        self.in_list = False
        self.list_type = None
        self.list_counter = 0
    
    def handle_starttag(self, tag, attrs):
        if self.current_text.strip():
            self.elements.append((self.current_tag or 'p', self.current_text.strip()))
            self.current_text = ""
        self.current_tag = tag
        if tag == 'ul':
            self.in_list = True
            self.list_type = 'ul'
        elif tag == 'ol':
            self.in_list = True
            self.list_type = 'ol'
            self.list_counter = 0
        elif tag == 'li' and self.list_type == 'ol':
            self.list_counter += 1
    
    def handle_endtag(self, tag):
        if self.current_text.strip():
            if tag == 'li' and self.in_list:
                prefix = f"{self.list_counter}. " if self.list_type == 'ol' else "- "
                self.elements.append(('li', prefix + self.current_text.strip()))
            else:
                self.elements.append((tag, self.current_text.strip()))
            self.current_text = ""
        if tag in ('ul', 'ol'):
            self.in_list = False
            self.list_type = None
        self.current_tag = None
    
    def handle_data(self, data):
        self.current_text += data


class DocumentPDF(FPDF):
    """Custom PDF class for compliance documents"""
    
    def __init__(self, title="Radio Check Document"):
        super().__init__()
        self.doc_title = title
        # Use built-in fonts only
        self.set_auto_page_break(auto=True, margin=25)
    
    def header(self):
        self.set_font('Helvetica', 'B', 12)
        self.set_text_color(26, 54, 93)  # Dark blue
        self.cell(0, 10, 'Radio Check', align='C')
        self.ln(5)
        self.set_font('Helvetica', '', 9)
        self.set_text_color(100, 100, 100)
        self.cell(0, 5, 'Veterans Mental Health Support', align='C')
        self.ln(10)
        # Separator line
        self.set_draw_color(49, 130, 206)
        self.line(10, self.get_y(), 200, self.get_y())
        self.ln(5)
    
    def footer(self):
        self.set_y(-20)
        self.set_font('Helvetica', 'I', 8)
        self.set_text_color(128, 128, 128)
        self.cell(0, 10, 'Radio Check - Confidential', align='L')
        self.cell(0, 10, f'Page {self.page_no()}/{{nb}}', align='R')
    
    def add_title(self, title):
        self.set_font('Helvetica', 'B', 20)
        self.set_text_color(26, 54, 93)
        self.multi_cell(0, 12, title)
        self.ln(5)
    
    def add_confidential_notice(self):
        self.set_fill_color(254, 215, 215)  # Light red
        self.set_text_color(197, 48, 48)  # Dark red
        self.set_font('Helvetica', 'B', 10)
        self.cell(0, 10, 'CONFIDENTIAL - FOR AUTHORIZED PERSONNEL ONLY', 
                  align='C', fill=True)
        self.ln(10)
        self.set_text_color(0, 0, 0)
    
    def add_heading(self, text, level=1):
        text = sanitize_text(text)
        if level == 1:
            self.set_font('Helvetica', 'B', 16)
            self.set_text_color(26, 54, 93)
        elif level == 2:
            self.set_font('Helvetica', 'B', 14)
            self.set_text_color(44, 82, 130)
        elif level == 3:
            self.set_font('Helvetica', 'B', 12)
            self.set_text_color(45, 55, 72)
        else:
            self.set_font('Helvetica', 'B', 11)
            self.set_text_color(74, 85, 104)
        
        self.ln(5)
        self.multi_cell(0, 8, text)
        self.ln(3)
        self.set_text_color(0, 0, 0)
    
    def add_paragraph(self, text):
        text = sanitize_text(text)
        self.set_font('Helvetica', '', 10)
        self.set_text_color(51, 51, 51)
        # Clean up text
        text = re.sub(r'\s+', ' ', text).strip()
        self.multi_cell(0, 6, text)
        self.ln(3)
    
    def add_list_item(self, text):
        text = sanitize_text(text)
        self.set_font('Helvetica', '', 10)
        self.set_text_color(51, 51, 51)
        self.set_x(15)  # Indent
        self.multi_cell(0, 6, text)
        self.ln(1)
    
    def add_code_block(self, text):
        text = sanitize_text(text)
        self.set_fill_color(247, 250, 252)
        self.set_font('Courier', '', 9)
        self.set_x(15)
        self.multi_cell(0, 5, text, fill=True)
        self.ln(3)


def markdown_to_pdf(md_content: str, title: str) -> bytes:
    """Convert markdown content to PDF bytes"""
    
    # Convert markdown to HTML
    md = markdown.Markdown(extensions=['tables', 'fenced_code'])
    html_content = md.convert(md_content)
    
    # Parse HTML to extract elements
    parser = HTMLtoPDFParser()
    parser.feed(html_content)
    
    # Create PDF
    pdf = DocumentPDF(title=title)
    pdf.alias_nb_pages()
    pdf.add_page()
    
    # Add title and confidential notice
    pdf.add_title(title)
    pdf.add_confidential_notice()
    
    # Add generation info
    import datetime
    pdf.set_font('Helvetica', '', 9)
    pdf.set_text_color(100, 100, 100)
    pdf.cell(0, 5, f"Generated: {datetime.datetime.now().strftime('%Y-%m-%d %H:%M')}")
    pdf.ln(10)
    
    # Process elements
    for tag, text in parser.elements:
        if not text:
            continue
        
        if tag == 'h1':
            pdf.add_heading(text, 1)
        elif tag == 'h2':
            pdf.add_heading(text, 2)
        elif tag == 'h3':
            pdf.add_heading(text, 3)
        elif tag in ('h4', 'h5', 'h6'):
            pdf.add_heading(text, 4)
        elif tag == 'li':
            pdf.add_list_item(text)
        elif tag in ('code', 'pre'):
            pdf.add_code_block(text)
        else:
            pdf.add_paragraph(text)
    
    return pdf.output()


@router.get("/list")
async def list_documents():
    """List all available compliance documents"""
    documents = []
    for key, filename in DOCUMENTS.items():
        filepath = DOCS_PATH / filename
        if filepath.exists():
            stat = filepath.stat()
            documents.append({
                "id": key,
                "filename": filename,
                "title": key.replace("_", " ").title(),
                "size_kb": round(stat.st_size / 1024, 1),
                "download_url": f"/api/documents/download/{key}"
            })
    return {"documents": documents}


@router.get("/download/{doc_id}")
async def download_document(doc_id: str, format: str = "pdf"):
    """
    Download a compliance document
    
    Args:
        doc_id: Document identifier (e.g., ROPA, BACP_COMPLIANCE, GDPR_AUDIT)
        format: Output format - 'pdf' or 'md' (default: pdf)
    """
    if doc_id not in DOCUMENTS:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found")
    
    filename = DOCUMENTS[doc_id]
    filepath = DOCS_PATH / filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"Document file not found: {filename}")
    
    try:
        # Read markdown content
        with open(filepath, 'r', encoding='utf-8') as f:
            md_content = f.read()
        
        if format == "md":
            # Return raw markdown
            return Response(
                content=md_content,
                media_type="text/markdown",
                headers={
                    "Content-Disposition": f'attachment; filename="{filename}"'
                }
            )
        
        # Convert to PDF using fpdf2
        title = doc_id.replace('_', ' ').title()
        pdf_bytes = markdown_to_pdf(md_content, title)
        
        pdf_filename = filename.replace('.md', '.pdf')
        
        return Response(
            content=bytes(pdf_bytes),
            media_type="application/pdf",
            headers={
                "Content-Disposition": f'attachment; filename="{pdf_filename}"'
            }
        )
        
    except Exception as e:
        logger.error(f"Error generating document {doc_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error generating document: {str(e)}")


@router.get("/preview/{doc_id}")
async def preview_document(doc_id: str):
    """
    Get HTML preview of a document (for in-browser viewing)
    """
    if doc_id not in DOCUMENTS:
        raise HTTPException(status_code=404, detail=f"Document '{doc_id}' not found")
    
    filename = DOCUMENTS[doc_id]
    filepath = DOCS_PATH / filename
    
    if not filepath.exists():
        raise HTTPException(status_code=404, detail=f"Document file not found: {filename}")
    
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            md_content = f.read()
        
        md = markdown.Markdown(extensions=['tables', 'fenced_code', 'toc'])
        html_content = md.convert(md_content)
        
        return {
            "id": doc_id,
            "title": doc_id.replace('_', ' ').title(),
            "html": html_content,
            "toc": md.toc if hasattr(md, 'toc') else None
        }
        
    except Exception as e:
        logger.error(f"Error previewing document {doc_id}: {e}")
        raise HTTPException(status_code=500, detail=f"Error previewing document: {str(e)}")
