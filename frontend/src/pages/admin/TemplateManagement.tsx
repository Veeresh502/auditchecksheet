import { useState, useEffect } from 'react';
import { Container, Button, Form, Row, Col, Card, Table, Alert, Spinner, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { FaUpload, FaTrash, FaCheck, FaFileCsv } from 'react-icons/fa';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import ConfirmationModal from '../../components/common/ConfirmationModal';

const TemplateManagement = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [uploading, setUploading] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [templateToDelete, setTemplateToDelete] = useState<string | null>(null);

    useEffect(() => {
        fetchTemplates();
    }, []);

    const fetchTemplates = async () => {
        try {
            setLoading(true);
            const res = await api.get('/templates');
            setTemplates(res.data);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load templates");
        } finally {
            setLoading(false);
        }
    };

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
        }
    };

    const handleUpload = async () => {
        if (!selectedFile) return;

        const formData = new FormData();
        formData.append('file', selectedFile);

        try {
            setUploading(true);
            const res = await api.post('/templates/import-csv', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            toast.success(res.data.message || "Template imported successfully");
            setSelectedFile(null);
            // Reset file input
            const fileInput = document.getElementById('csv-upload') as HTMLInputElement;
            if (fileInput) fileInput.value = '';
            fetchTemplates();
        } catch (err: any) {
            console.error(err);
            toast.error(err.response?.data?.error || "Import failed. Ensure CSV columns are correct: 'Template Name', 'Section Name', 'Question Text', 'Input Type'");
        } finally {
            setUploading(false);
        }
    };

    const handleDeleteTemplate = async () => {
        if (!templateToDelete) return;
        try {
            await api.delete(`/templates/${templateToDelete}`);
            toast.success("Template deleted successfully");
            fetchTemplates();
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete template. Ensure no audits are using it.");
        } finally {
            setTemplateToDelete(null);
        }
    };

    return (
        <Container fluid className="py-4">
            <div className="mb-4">
                <Button variant="link" className="text-decoration-none text-muted p-0 mb-3" onClick={() => navigate('/admin/dashboard')}>
                    ← Back to Dashboard
                </Button>
                <h2 className="fw-bold">Audit Template Management</h2>
                <p className="text-muted">Upload and manage audit checksheets via CSV structure.</p>
            </div>

            <Row>
                <Col lg={4}>
                    <Card className="shadow-sm border-0 mb-4">
                        <Card.Header className="bg-white py-3">
                            <h5 className="mb-0 fw-bold d-flex align-items-center gap-2">
                                <FaUpload className="text-primary" /> Import Template (CSV)
                            </h5>
                        </Card.Header>
                        <Card.Body>
                            <Alert variant="info" className="small border-0 shadow-none">
                                <p className="mb-1"><strong>Required CSV Columns:</strong></p>
                                <ul className="mb-0 ps-3">
                                    <li>Template Name</li>
                                    <li>Section Name</li>
                                    <li>Question Text</li>
                                    <li>Input Type (standard, calibration_row, shift_reading)</li>
                                </ul>
                            </Alert>

                            <Form.Group className="mb-3">
                                <Form.Label className="small fw-bold">Select CSV File</Form.Label>
                                <div className="d-flex gap-2">
                                    <Form.Control
                                        type="file"
                                        id="csv-upload"
                                        accept=".csv"
                                        onChange={handleFileChange}
                                        className="form-control-sm"
                                    />
                                </div>
                            </Form.Group>

                            <Button
                                variant="primary"
                                className="w-100 fw-bold d-flex align-items-center justify-content-center gap-2 py-2"
                                disabled={!selectedFile || uploading}
                                onClick={handleUpload}
                            >
                                {uploading ? <Spinner size="sm" /> : <FaCheck />}
                                {uploading ? 'Processing...' : 'Upload & Analyze Template'}
                            </Button>
                        </Card.Body>
                    </Card>

                    <Card className="shadow-sm border-0 bg-light">
                        <Card.Body className="p-4 text-center">
                            <FaFileCsv size={40} className="text-muted mb-3" />
                            <h6 className="fw-bold mb-2">Instructions</h6>
                            <p className="small text-muted mb-0">
                                This automated system will analyze your CSV, create sections, and map questions to the database. Use 'standard' for normal OK/NC/Obs/NA questions.
                            </p>
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={8}>
                    <Card className="shadow-sm border-0">
                        <Card.Header className="bg-white py-3 d-flex justify-content-between align-items-center">
                            <h5 className="mb-0 fw-bold">Active Templates</h5>
                            <Badge bg="primary">{templates.length}</Badge>
                        </Card.Header>
                        <Card.Body className="p-0">
                            {loading ? (
                                <div className="text-center py-5">
                                    <Spinner animation="border" variant="primary" />
                                </div>
                            ) : templates.length === 0 ? (
                                <div className="text-center py-5 text-muted">
                                    No templates found. Upload your first one!
                                </div>
                            ) : (
                                <Table hover responsive className="mb-0 align-middle">
                                    <thead className="table-light">
                                        <tr>
                                            <th>Template Name</th>
                                            <th>Description</th>
                                            <th>Created At</th>
                                            <th className="text-center">Action</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {templates.map(t => (
                                            <tr key={t.template_id}>
                                                <td className="fw-bold">{t.template_name}</td>
                                                <td className="small text-muted">{t.description || 'No description'}</td>
                                                <td className="small">{new Date(t.created_at).toLocaleDateString()}</td>
                                                <td className="text-center">
                                                    <div className="d-flex justify-content-center gap-2">
                                                        <Button variant="outline-primary" size="sm" onClick={() => navigate(`/admin/schedule?template=${t.template_id}`)}>
                                                            Use
                                                        </Button>
                                                        <Button variant="outline-danger" size="sm" onClick={() => setTemplateToDelete(t.template_id)}>
                                                            <FaTrash />
                                                        </Button>
                                                    </div>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </Table>
                            )}
                        </Card.Body>
                    </Card>
                </Col>
            </Row>

            <ConfirmationModal
                show={!!templateToDelete}
                onClose={() => setTemplateToDelete(null)}
                onConfirm={handleDeleteTemplate}
                title="Delete Template"
                message="Are you sure you want to delete this template? This cannot be undone."
                confirmText="Delete"
                variant="danger"
            />
        </Container>
    );
};

export default TemplateManagement;
