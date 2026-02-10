import { Modal, Button, Row, Col, Badge, Spinner } from 'react-bootstrap';
import { FaFileDownload, FaTrash, FaExternalLinkAlt, FaTimes } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';

interface AuditDetailsModalProps {
    show: boolean;
    onHide: () => void;
    audit: any;
    onDownloadExcel: (id: string) => void;
    onDelete: (id: string) => void;
    isDeleting: boolean;
}

const AuditDetailsModal = ({ show, onHide, audit, onDownloadExcel, onDelete, isDeleting }: AuditDetailsModalProps) => {
    const navigate = useNavigate();

    if (!audit) return null;

    return (
        <Modal show={show} onHide={onHide} centered size="lg">
            <Modal.Header closeButton className="border-0 pb-0">
                <Modal.Title className="fw-bold text-primary">Audit Details</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <div className="bg-light p-3 rounded mb-4">
                    <Row className="g-3">
                        <Col xs={6} md={4}>
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.75rem' }}>Audit ID</small>
                            <div className="fw-bold text-break" style={{ fontSize: '0.9rem' }}>{audit.audit_id}</div>
                        </Col>
                        <Col xs={6} md={4}>
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.75rem' }}>Date</small>
                            <div className="fw-bold">{new Date(audit.audit_date).toLocaleDateString()}</div>
                        </Col>
                        <Col xs={6} md={4}>
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.75rem' }}>Status</small>
                            <Badge bg={audit.status.includes('NC') ? 'danger' : audit.status === 'Completed' ? 'success' : 'primary'} className="rounded-pill">
                                {audit.status.replace(/_/g, ' ')}
                            </Badge>
                        </Col>

                        <Col xs={12}><hr className="my-1 text-muted opacity-25" /></Col>

                        <Col xs={6}>
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.75rem' }}>Machine / Asset</small>
                            <div className="fw-bold fs-5">{audit.machine_name}</div>
                        </Col>
                        <Col xs={6}>
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.75rem' }}>Checklist Type</small>
                            <div className="fw-bold">{audit.template_name}</div>
                        </Col>

                        <Col xs={12}><hr className="my-1 text-muted opacity-25" /></Col>

                        <Col xs={4}>
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.75rem' }}>L1 Auditor</small>
                            <div className="fw-medium">{audit.l1_auditor_name || '-'}</div>
                        </Col>
                        <Col xs={4}>
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.75rem' }}>L2 Auditor</small>
                            <div className="fw-medium">{audit.l2_auditor_name || '-'}</div>
                        </Col>
                        <Col xs={4}>
                            <small className="text-muted d-block text-uppercase" style={{ fontSize: '0.75rem' }}>Process Owner</small>
                            <div className="fw-medium">{audit.process_owner_name || '-'}</div>
                        </Col>
                    </Row>
                </div>

                <div className="d-grid gap-2">
                    <Button variant="outline-primary" className="d-flex align-items-center justify-content-center gap-2" onClick={() => navigate(`/admin/audit/${audit.audit_id}`)}>
                        <FaExternalLinkAlt /> Open Full Audit Workspace
                    </Button>
                    <Button variant="outline-success" className="d-flex align-items-center justify-content-center gap-2" onClick={() => onDownloadExcel(audit.audit_id)}>
                        <FaFileDownload /> Download Excel Report
                    </Button>
                </div>

            </Modal.Body>
            <Modal.Footer className="border-0 pt-0 justify-content-between">
                <Button variant="ghost" onClick={onHide} className="text-muted"><FaTimes className="me-1" /> Close</Button>
                <Button variant="danger" disabled={isDeleting} onClick={() => onDelete(audit.audit_id)}>
                    {isDeleting ? <Spinner size="sm" /> : <><FaTrash className="me-2" /> Delete Audit</>}
                </Button>
            </Modal.Footer>
        </Modal>
    );
};

export default AuditDetailsModal;
