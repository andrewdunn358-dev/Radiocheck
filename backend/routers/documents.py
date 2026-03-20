"""
Documents Router - Serves compliance documents as PDFs
"""
import os
import logging
from io import BytesIO
from pathlib import Path
from fastapi import APIRouter, HTTPException
from fastapi.responses import Response, JSONResponse
import markdown

router = APIRouter(prefix="/documents", tags=["documents"])
logger = logging.getLogger(__name__)

# Lazy import weasyprint - only needed for PDF generation
# This allows the server to start even if weasyprint isn't installed
_weasyprint_available = False
HTML = None
CSS = None

try:
    from weasyprint import HTML, CSS
    _weasyprint_available = True
except ImportError:
    logger.warning("weasyprint not available - PDF generation disabled, markdown download still works")

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

# CSS styling for PDF documents
PDF_CSS = """
@page {
    size: A4;
    margin: 2cm;
    @bottom-center {
        content: "Radio Check - Confidential";
        font-size: 10px;
        color: #666;
    }
    @bottom-right {
        content: "Page " counter(page) " of " counter(pages);
        font-size: 10px;
        color: #666;
    }
}

body {
    font-family: 'Helvetica Neue', Arial, sans-serif;
    font-size: 11pt;
    line-height: 1.6;
    color: #333;
}

h1 {
    color: #1a365d;
    border-bottom: 3px solid #3182ce;
    padding-bottom: 10px;
    font-size: 24pt;
    margin-top: 0;
}

h2 {
    color: #2c5282;
    border-bottom: 1px solid #cbd5e0;
    padding-bottom: 5px;
    font-size: 16pt;
    margin-top: 24pt;
}

h3 {
    color: #2d3748;
    font-size: 13pt;
    margin-top: 18pt;
}

h4 {
    color: #4a5568;
    font-size: 11pt;
    margin-top: 14pt;
}

p {
    margin-bottom: 10pt;
    text-align: justify;
}

ul, ol {
    margin-left: 20pt;
    margin-bottom: 10pt;
}

li {
    margin-bottom: 5pt;
}

code {
    background-color: #f7fafc;
    padding: 2px 6px;
    border-radius: 3px;
    font-family: 'Courier New', monospace;
    font-size: 10pt;
}

pre {
    background-color: #f7fafc;
    padding: 15px;
    border-radius: 5px;
    border: 1px solid #e2e8f0;
    overflow-x: auto;
    font-size: 9pt;
}

blockquote {
    border-left: 4px solid #3182ce;
    margin-left: 0;
    padding-left: 20px;
    color: #4a5568;
    font-style: italic;
}

table {
    width: 100%;
    border-collapse: collapse;
    margin: 15pt 0;
}

th, td {
    border: 1px solid #e2e8f0;
    padding: 8px 12px;
    text-align: left;
}

th {
    background-color: #edf2f7;
    font-weight: bold;
    color: #2d3748;
}

tr:nth-child(even) {
    background-color: #f7fafc;
}

.header {
    text-align: center;
    margin-bottom: 30pt;
    padding-bottom: 20pt;
    border-bottom: 2px solid #3182ce;
}

.header img {
    max-width: 150px;
    margin-bottom: 10pt;
}

.confidential-notice {
    background-color: #fed7d7;
    border: 1px solid #fc8181;
    color: #c53030;
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 20pt;
    font-weight: bold;
    text-align: center;
}

.version-info {
    background-color: #e6fffa;
    border: 1px solid #81e6d9;
    padding: 10px;
    border-radius: 5px;
    margin-bottom: 20pt;
    font-size: 10pt;
}
"""

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
        
        # PDF format requested - check if weasyprint is available
        if not _weasyprint_available:
            raise HTTPException(
                status_code=503, 
                detail="PDF generation is not available. Please download as markdown format instead using ?format=md"
            )
        
        # Convert markdown to HTML
        md = markdown.Markdown(extensions=['tables', 'fenced_code', 'toc'])
        html_content = md.convert(md_content)
        
        # Add header and styling
        full_html = f"""
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="UTF-8">
            <title>{doc_id.replace('_', ' ').title()} - Radio Check</title>
        </head>
        <body>
            <div class="header">
                <h1 style="margin-bottom: 5px;">Radio Check</h1>
                <p style="color: #666; margin: 0;">Veterans Mental Health Support</p>
            </div>
            <div class="confidential-notice">
                CONFIDENTIAL - FOR AUTHORIZED PERSONNEL ONLY
            </div>
            <div class="version-info">
                <strong>Document:</strong> {doc_id.replace('_', ' ').title()}<br>
                <strong>Generated:</strong> {__import__('datetime').datetime.now().strftime('%Y-%m-%d %H:%M')}
            </div>
            {html_content}
        </body>
        </html>
        """
        
        # Convert HTML to PDF
        pdf_buffer = BytesIO()
        HTML(string=full_html).write_pdf(
            pdf_buffer,
            stylesheets=[CSS(string=PDF_CSS)]
        )
        pdf_buffer.seek(0)
        
        pdf_filename = filename.replace('.md', '.pdf')
        
        return Response(
            content=pdf_buffer.getvalue(),
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
