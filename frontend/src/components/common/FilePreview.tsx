import { useState, useId } from 'react';
import { Image, Modal } from 'react-bootstrap';
import { FaFilePdf, FaExternalLinkAlt, FaSearchPlus } from 'react-icons/fa';

interface Props {
  fileUrl: string | null;
}

const FilePreview = ({ fileUrl }: Props) => {
  const [showModal, setShowModal] = useState(false);

  if (!fileUrl) return null;

  const uniqueId = useId();

  // Ensure correct URL path (Backend runs on port 3000)
  // Check if it already starts with http to avoid double-prefixing
  const fullUrl = fileUrl.startsWith('http')
    ? fileUrl
    : `http://localhost:3000${fileUrl.startsWith('/') ? '' : '/'}${fileUrl}`;

  const isPdf = fileUrl.toLowerCase().endsWith('.pdf');

  return (
    <>
      <div className="mt-2 p-2 border rounded bg-light d-inline-block">
        {isPdf ? (
          <a href={fullUrl} target="_blank" rel="noreferrer" className="text-decoration-none text-danger fw-bold">
            <FaFilePdf size={20} className="me-2" />
            View PDF Document <FaExternalLinkAlt size={12} className="ms-1" />
          </a>
        ) : (
          <div style={{ cursor: 'pointer' }} onClick={() => setShowModal(true)}>
            <Image src={fullUrl} alt="Evidence" thumbnail style={{ maxHeight: '150px', maxWidth: '100%' }} />
            <div className="mt-1 text-center">
              <small className="text-primary fw-bold">
                <FaSearchPlus className="me-1" /> View Full Size
              </small>
            </div>
          </div>
        )}
      </div>

      {/* Image Preview Modal */}
      {!isPdf && (
        <Modal show={showModal} onHide={() => setShowModal(false)} size="lg" centered id={`modal-${uniqueId}`}>
          <Modal.Header closeButton>
            <Modal.Title>Evidence Preview</Modal.Title>
          </Modal.Header>
          <Modal.Body className="text-center bg-light">
            <Image
              src={fullUrl}
              alt="Evidence Full"
              className="img-fluid d-block mx-auto"
              style={{ maxHeight: '85vh', objectFit: 'contain' }}
            />
          </Modal.Body>
        </Modal>
      )}
    </>
  );
};

export default FilePreview;