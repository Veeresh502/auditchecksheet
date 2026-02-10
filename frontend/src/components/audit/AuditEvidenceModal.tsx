import { useState, useEffect } from 'react';
import { Modal, Button, Spinner, Row, Col, Card } from 'react-bootstrap';
import api from '../../api/axios';
import FilePreview from '../common/FilePreview';
import { FaPaperclip } from 'react-icons/fa';

interface Props {
    show: boolean;
    onHide: () => void;
    auditId: string | null;
}

const AuditEvidenceModal = ({ show, onHide, auditId }: Props) => {
    const [loading, setLoading] = useState(false);
    const [data, setData] = useState<any>(null);
    const [error, setError] = useState('');

    useEffect(() => {
        if (show && auditId) {
            fetchEvidence();
        } else {
            setData(null); // Reset when closed
        }
    }, [show, auditId]);

    const fetchEvidence = async () => {
        if (!auditId) return;
        setLoading(true);
        try {
            const res = await api.get(`/audits/${auditId}/full`);
            setData(res.data);
            setError('');
        } catch (err: any) {
            console.error(err);
            setError('Failed to load evidence.');
        } finally {
            setLoading(false);
        }
    };

    // Helper to collect all questions with files
    const getEvidenceList = () => {
        if (!data || !data.data || !data.data.checklist) return [];
        return data.data.checklist.filter((item: any) => item.file_url);
    };

    const evidenceList = getEvidenceList();

    return (
        <Modal show={show} onHide={onHide} size="xl" centered>
            <Modal.Header closeButton className="bg-light">
                <Modal.Title className="fw-bold">
                    <FaPaperclip className="me-2" /> Audit Evidence & Signatures
                </Modal.Title>
            </Modal.Header>
            <Modal.Body className="bg-light" style={{ minHeight: '50vh' }}>
                {loading ? (
                    <div className="text-center py-5">
                        <Spinner animation="border" variant="primary" />
                        <p className="mt-2 text-muted">Loading evidence...</p>
                    </div>
                ) : error ? (
                    <div className="alert alert-danger">{error}</div>
                ) : !data ? (
                    <p className="text-center py-4">No data loaded.</p>
                ) : (
                    <div>
                        {/* 1. Header Info */}
                        <div className="mb-4 p-3 bg-white rounded shadow-sm border-start border-4 border-primary">
                            <h5 className="mb-1">{data.audit.machine_name} - {data.audit.template_name}</h5>
                            <small className="text-muted">
                                ID: {data.audit.audit_id} | Date: {new Date(data.audit.audit_date).toLocaleDateString()}
                            </small>
                        </div>

                        {/* 3. Checklist Evidence Grid */}
                        <h6 className="fw-bold mb-3 border-bottom pb-2">Checklist Attachments ({evidenceList.length})</h6>

                        {evidenceList.length === 0 ? (
                            <div className="text-center p-5 border border-dashed rounded text-muted bg-white">
                                No evidence files attached to checklist items.
                            </div>
                        ) : (
                            <Row className="g-3">
                                {evidenceList.map((item: any, idx: number) => (
                                    <Col key={idx} md={4} lg={3}>
                                        <Card className="h-100 shadow-sm border-0">
                                            <Card.Body className="p-2 d-flex flex-column align-items-center bg-white rounded">
                                                <FilePreview fileUrl={item.file_url} />
                                                <div className="mt-2 w-100 p-2 bg-light rounded text-start">
                                                    <small className="d-block text-truncate fw-bold" title={item.question_text}>
                                                        Q: {item.question_text}
                                                    </small>
                                                    <small className="text-muted d-block text-truncate">
                                                        Obs: {item.l1_observation || 'No observation'}
                                                    </small>
                                                </div>
                                            </Card.Body>
                                        </Card>
                                    </Col>
                                ))}
                            </Row>
                        )}
                    </div>
                )}
            </Modal.Body>
            <Modal.Footer>
                <Button variant="secondary" onClick={onHide}>Close</Button>
            </Modal.Footer>
        </Modal>
    );
};

export default AuditEvidenceModal;
