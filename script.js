let pdfDoc = null;
let currentPage = 1;
let signaturePad = null;
let signatureImage = null;
let signaturePositions = {};
let pdfBytes = null;

const primaryColor = 'rgb(52, 152, 219)';
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    checkOrientation();
    window.addEventListener('orientationchange', checkOrientation);
    window.addEventListener('resize', handleResize);
});

function setupEventListeners() {
    document.getElementById('pdf-file').addEventListener('change', handlePDFUpload);
    document.getElementById('prev-page').addEventListener('click', previousPage);
    document.getElementById('next-page').addEventListener('click', nextPage);
    document.getElementById('sig-size').addEventListener('input', updateSignatureSize);
    document.getElementById('sig-rotation').addEventListener('input', updateSignatureRotation);
    document.getElementById('load-signature').addEventListener('click', openSignatureModal);
    document.getElementById('clear-signatures').addEventListener('click', clearAllSignatures);
    document.getElementById('save-sig').addEventListener('click', saveSignature);
    document.getElementById('cancel-sig').addEventListener('click', closeSignatureModal);
    document.getElementById('clear-sig').addEventListener('click', clearSignaturePad);
    document.querySelector('.close-modal').addEventListener('click', closeSignatureModal);
    document.getElementById('download-pdf').addEventListener('click', downloadSignedPDF);
    
    document.addEventListener('mousedown', startDrag);
    document.addEventListener('touchstart', startDrag, {passive: false});
    document.addEventListener('mousemove', drag);
    document.addEventListener('touchmove', drag, {passive: false});
    document.addEventListener('mouseup', stopDrag);
    document.addEventListener('touchend', stopDrag);
}

async function handlePDFUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
        pdfBytes = event.target.result;
        await loadPDF(pdfBytes);
        
        const fileInfo = document.getElementById('file-info');
        fileInfo.innerHTML = `<strong>�� PDF Carregado:</strong> ${file.name}<br><strong>Tamanho:</strong> ${(file.size / 1024).toFixed(2)} KB`;
        fileInfo.style.display = 'block';

        document.getElementById('section-viewer').style.display = 'block';
        document.getElementById('section-download').style.display = 'block';
    };
    reader.readAsArrayBuffer(file);
}

async function loadPDF(arrayBuffer) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    
    try {
        pdfDoc = await pdfjsLib.getDocument({data: arrayBuffer}).promise;
        document.getElementById('total-pages').textContent = pdfDoc.numPages;
        currentPage = 1;
        signaturePositions = {};
        
        renderPDFPage(currentPage);
    } catch (error) {
        alert('Erro ao carregar PDF: ' + error.message);
    }
}

async function renderPDFPage(pageNum) {
    if (!pdfDoc || pageNum < 1 || pageNum > pdfDoc.numPages) return;

    try {
        const page = await pdfDoc.getPage(pageNum);
        const canvas = document.getElementById('pdf-canvas');
        const viewport = page.getViewport({scale: 2});

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        const context = canvas.getContext('2d');
        await page.render({
            canvasContext: context,
            viewport: viewport
        }).promise;

        document.getElementById('current-page').textContent = pageNum;
        showSignaturePreview(pageNum);
    } catch (error) {
        console.error('Erro ao renderizar página:', error);
    }
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderPDFPage(currentPage);
    }
}

function nextPage() {
    if (pdfDoc && currentPage < pdfDoc.numPages) {
        currentPage++;
        renderPDFPage(currentPage);
    }
}

function openSignatureModal() {
    const modal = document.getElementById('signature-modal');
    modal.classList.remove('hidden');

    setTimeout(() => {
        initializeSignaturePad();
    }, 100);
}

function closeSignatureModal() {
    document.getElementById('signature-modal').classList.add('hidden');
}

function initializeSignaturePad() {
    const canvas = document.getElementById('signature-canvas');
    const container = document.getElementById('canvas-container');

    const rect = container.getBoundingClientRect();
    canvas.width = rect.width;
    canvas.height = rect.height;

    if (signaturePad) signaturePad.clear();
    signaturePad = new SignaturePad(canvas, {
        penColor: primaryColor,
        minWidth: 2,
        maxWidth: 4,
        velocity: 2,
        throttle: 16,
        minDistance: 5
    });

    const resizeHandler = () => {
        const newRect = container.getBoundingClientRect();
        canvas.width = newRect.width;
        canvas.height = newRect.height;
        signaturePad.clear();
    };

    window.addEventListener('orientationchange', resizeHandler);
}

function clearSignaturePad() {
    if (signaturePad) signaturePad.clear();
}

function saveSignature() {
    if (!signaturePad || signaturePad.isEmpty()) {
        alert('Por favor, desenhe uma assinatura!');
        return;
    }

    signatureImage = signaturePad.toDataURL('image/png');
    closeSignatureModal();

    positionSignature(currentPage);
    showSignaturePreview(currentPage);
}

function showSignaturePreview(pageNum) {
    const previewBox = document.getElementById('signature-preview-box');
    const previewImg = document.getElementById('signature-preview-img');

    if (!signatureImage) {
        previewBox.classList.add('hidden');
        return;
    }

    const position = signaturePositions[pageNum] || {x: 50, y: 50, width: 120, rotation: 0};
    
    previewImg.src = signatureImage;
    previewImg.onload = () => {
        previewBox.style.left = position.x + 'px';
        previewBox.style.top = position.y + 'px';
        previewBox.style.width = position.width + 'px';
        previewBox.style.height = (position.width * 0.5) + 'px';
        previewBox.style.transform = `rotate(${position.rotation}deg)`;
        previewBox.classList.remove('hidden');
    };
}

function positionSignature(pageNum) {
    const size = parseInt(document.getElementById('sig-size').value);
    const rotation = parseInt(document.getElementById('sig-rotation').value);

    signaturePositions[pageNum] = {
        x: 50,
        y: 50,
        width: size,
        rotation: rotation
    };
}

function updateSignatureSize(e) {
    const size = e.target.value;
    document.getElementById('size-value').textContent = size;
    
    if (signaturePositions[currentPage]) {
        signaturePositions[currentPage].width = parseInt(size);
    }
    showSignaturePreview(currentPage);
}

function updateSignatureRotation(e) {
    const rotation = e.target.value;
    document.getElementById('rotation-value').textContent = rotation;
    
    if (signaturePositions[currentPage]) {
        signaturePositions[currentPage].rotation = parseInt(rotation);
    }
    showSignaturePreview(currentPage);
}

function clearAllSignatures() {
    if (confirm('Deseja limpar todas as assinaturas?')) {
        signatureImage = null;
        signaturePositions = {};
        document.getElementById('signature-preview-box').classList.add('hidden');
        renderPDFPage(currentPage);
    }
}

let isDragging = false;
let isResizing = false;
let startX, startY, startWidth;

function startDrag(e) {
    const previewBox = document.getElementById('signature-preview-box');
    if (previewBox.classList.contains('hidden')) return;

    const target = e.target;
    if (target.classList.contains('resize-handle')) {
        isResizing = true;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
        startWidth = previewBox.offsetWidth;
    } else if (previewBox.contains(target)) {
        isDragging = true;
        startX = e.touches ? e.touches[0].clientX : e.clientX;
        startY = e.touches ? e.touches[0].clientY : e.clientY;
    }
}

function drag(e) {
    if (!isDragging && !isResizing) return;
    e.preventDefault();

    const previewBox = document.getElementById('signature-preview-box');
    const viewer = document.getElementById('pdf-viewer');
    const viewerRect = viewer.getBoundingClientRect();
    const canvasRect = document.getElementById('pdf-canvas').getBoundingClientRect();

    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    if (isDragging) {
        const deltaX = clientX - startX;
        const deltaY = clientY - startY;

        const newX = Math.max(0, Math.min(previewBox.offsetLeft + deltaX, canvasRect.width - previewBox.offsetWidth));
        const newY = Math.max(0, Math.min(previewBox.offsetTop + deltaY, canvasRect.height - previewBox.offsetHeight));

        previewBox.style.left = newX + 'px';
        previewBox.style.top = newY + 'px';

        signaturePositions[currentPage].x = newX;
        signaturePositions[currentPage].y = newY;

        startX = clientX;
        startY = clientY;
    } else if (isResizing) {
        const deltaX = clientX - startX;
        const newWidth = Math.max(50, Math.min(startWidth + deltaX, canvasRect.width));

        previewBox.style.width = newWidth + 'px';
        previewBox.style.height = (newWidth * 0.5) + 'px';

        document.getElementById('sig-size').value = newWidth;
        document.getElementById('size-value').textContent = newWidth;
        signaturePositions[currentPage].width = newWidth;
    }
}

function stopDrag() {
    isDragging = false;
    isResizing = false;
}

async function downloadSignedPDF() {
    if (!pdfDoc || !signatureImage) {
        alert('Por favor, carregue um PDF e crie uma assinatura!');
        return;
    }

    try {
        const { PDFDocument, PDFPage } = PDFLib;
        const pdfDoc = await PDFDocument.load(pdfBytes);
        const pages = pdfDoc.getPages();

        const pngImage = await pdfDoc.embedPng(signatureImage);
        const applyToAllPages = document.getElementById('apply-all-pages').checked;

        const pagesToSign = applyToAllPages 
            ? Object.keys(pages).map((_, i) => i) 
            : [currentPage - 1];

        for (const pageIndex of pagesToSign) {
            if (pageIndex >= pages.length) continue;

            const page = pages[pageIndex];
            const position = signaturePositions[pageIndex + 1] || signaturePositions[currentPage];

            if (position) {
                const scale = page.getWidth() / 595;
                const x = position.x * scale;
                const y = page.getHeight() - (position.y * scale) - (position.width * 0.5 * scale);
                const width = position.width * scale;
                const height = position.width * 0.5 * scale;

                page.drawImage(pngImage, {
                    x: x,
                    y: y,
                    width: width,
                    height: height,
                    rotate: { angle: position.rotation }
                });
            }
        }

        const pdfBytesResult = await pdfDoc.save();
        const blob = new Blob([pdfBytesResult], {type: 'application/pdf'});
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = 'documento_assinado.pdf';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);

        alert('✅ PDF assinado baixado com sucesso!');
    } catch (error) {
        alert('Erro ao gerar PDF: ' + error.message);
        console.error(error);
    }
}

function checkOrientation() {
    const warning = document.getElementById('orientation-warning');
    
    if (isMobile && window.innerHeight > window.innerWidth) {
        warning.classList.remove('hidden');
    } else {
        warning.classList.add('hidden');
    }
}

function handleResize() {
    if (pdfDoc) {
        renderPDFPage(currentPage);
    }
}
