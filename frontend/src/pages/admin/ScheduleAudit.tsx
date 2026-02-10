import { useState, useEffect } from 'react';
import { Container, Button, Form, Row, Col, Card, Modal, Table, Badge } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import PromptModal from '../../components/common/PromptModal';

const ScheduleAudit = () => {
    const navigate = useNavigate();
    const [templates, setTemplates] = useState([]);
    const [users, setUsers] = useState<any[]>([]);
    const [dockProducts, setDockProducts] = useState<string[]>([]);
    const [mfgProducts, setMfgProducts] = useState<string[]>([]);
    const mfgProcesses = [
        'Boring and Grooving', 'Lapping', 'Turning', 'Size Broaching', 'WP Pressing',
        'Broaching', 'Hub OD Grinding', 'Serration', 'Spline Rolling', 'Glide Coating',
        'Shaving', 'Back Face Grinding', 'UJ Profile Grinding', 'Face Grinding',
        'Welding', 'Painting', 'Grobbing', 'PCD Drilling', 'Surface Broaching',
        'Drilling and tapping', 'Nib milling', 'Hardning'
    ];

    // Scheduler State
    const [selectedTemplateName, setSelectedTemplateName] = useState('');
    const [scheduleData, setScheduleData] = useState({
        template_id: '',
        machine_name: '',
        audit_date: '',
        shift: 'A',
        l1_auditor_id: '',
        l2_auditor_id: '',
        process_owner_id: '',
        // Manufacturing fields
        operation: '',
        part_name: '',
        part_number: '',
        // Dock Audit fields
        series: '',
        invoice_no: '',
        doc_no: '',
        qty_audited: '',
        process: ''
    });

    // Question editor state
    const [showQuestionModal, setShowQuestionModal] = useState(false);
    const [selectedTemplateQuestions, setSelectedTemplateQuestions] = useState<any[]>([]);

    // Modal states
    const [questionToDelete, setQuestionToDelete] = useState<string | null>(null);
    const [sectionToAddQuestion, setSectionToAddQuestion] = useState<{ sectionId: string, order: number } | null>(null);

    const fetchData = async () => {
        try {
            const [tempRes, userRes, dockProdRes, mfgProdRes] = await Promise.all([
                api.get('/templates'),
                api.get('/users'),
                api.get('/dock-plan/products'),
                api.get('/mfg-plan/products')
            ]);
            setTemplates(tempRes.data);
            setUsers(userRes.data);
            setDockProducts(dockProdRes.data);
            setMfgProducts(mfgProdRes.data);

            // Set default template
            if (tempRes.data.length > 0) {
                const firstTemplate = tempRes.data[0];
                setScheduleData(prev => ({
                    ...prev,
                    template_id: firstTemplate.template_id,
                    machine_name: firstTemplate.template_name === 'Dock Audit' ? 'DOCK-AREA' : ''
                }));
                setSelectedTemplateName(firstTemplate.template_name);
            }
        } catch (err) {
            console.error("Failed to load scheduling data", err);
            toast.error("Failed to load templates or users.");
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const handleSchedule = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await api.post('/audits/schedule', scheduleData);
            toast.success("Audit Scheduled Successfully!");
            navigate('/admin/dashboard');
        } catch (err: any) {
            toast.error(err.response?.data?.error || "Scheduling failed");
        }
    };

    // Helper to filter users for dropdowns
    // Include 'Admin' in all dropdowns because they have overlapping roles (L1, L2, Owner)
    const getByRole = (role: string) => users.filter(u => u.role === role || u.role === 'Admin');

    // Question Editing Logic
    const handleViewQuestions = async () => {
        if (!scheduleData.template_id) return toast.warning("Select a template first");
        try {
            const res = await api.get(`/templates/${scheduleData.template_id}`);
            setSelectedTemplateQuestions(res.data.sections || []);
            setShowQuestionModal(true);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load questions");
        }
    };

    const handleUpdateQuestion = async (qId: string, text: string, type: string) => {
        try {
            await api.put(`/templates/questions/${qId}`, { question_text: text, input_type: type });
            handleViewQuestions();
        } catch (err) {
            console.error(err);
            toast.error("Failed to update question");
        }
    };

    const handleDeleteQuestion = async (qId: string) => {
        try {
            await api.delete(`/templates/questions/${qId}`);
            handleViewQuestions();
        } catch (err) {
            console.error(err);
            toast.error("Failed to delete question");
        }
    };

    const handleAddQuestion = async (secId: string, text: string, order: number) => {
        try {
            if (!scheduleData.template_id) return;
            await api.post(`/templates/${scheduleData.template_id}/sections/${secId}/questions`, {
                question_text: text,
                question_order: order,
                input_type: 'standard'
            });
            handleViewQuestions();
        } catch (err) {
            console.error(err);
            toast.error("Failed to add question");
        }
    };

    return (
        <Container className="py-4">
            <div className="mb-3">
                <Button variant="link" className="text-decoration-none text-muted p-0" onClick={() => navigate('/admin/dashboard')}>
                    ← Back to Dashboard
                </Button>
            </div>
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h2 className="fw-bold">Schedule New Audit</h2>
                    <p className="text-muted">Create a new audit plan implementation.</p>
                </div>
            </div>

            <Card className="shadow-sm border-0 p-3 p-md-4 mb-5">
                <Form onSubmit={handleSchedule}>
                    {/* Section 1: Audit Configuration */}
                    <div className="mb-4">
                        <h5 className="text-primary fw-bold mb-3 d-flex align-items-center">
                            <span className="bg-primary text-white rounded-circle me-2 d-inline-flex justify-content-center align-items-center" style={{ width: '24px', height: '24px', fontSize: '14px' }}>1</span>
                            Audit Configuration
                        </h5>
                        <hr className="mt-0 mb-3 opacity-25" />
                        <Row className="g-3">
                            <Col md={6}>
                                <Form.Label className="small fw-bold">Audit Template</Form.Label>
                                <div className="d-flex gap-2">
                                    <Form.Select
                                        value={scheduleData.template_id}
                                        onChange={e => {
                                            const selectedTemplate = templates.find((t: any) => t.template_id === e.target.value) as any;
                                            setScheduleData({
                                                ...scheduleData,
                                                template_id: e.target.value,
                                                machine_name: selectedTemplate?.template_name === 'Dock Audit' ? 'DOCK-AREA' : '',
                                                operation: '',
                                                part_name: '',
                                                part_number: '',
                                                series: '',
                                                invoice_no: '',
                                                doc_no: '',
                                                qty_audited: '',
                                                process: ''
                                            });
                                            setSelectedTemplateName(selectedTemplate?.template_name || '');
                                        }}
                                    >
                                        <option value="">Select Template...</option>
                                        {templates.map((t: any) => <option key={t.template_id} value={t.template_id}>{t.template_name}</option>)}
                                    </Form.Select>
                                    <Button variant="info" size="sm" className="px-3 fw-bold shadow-sm" onClick={handleViewQuestions}>View Checklist</Button>
                                </div>
                                <Form.Text className="text-muted small">
                                    Manage templates in <Button variant="link" className="p-0 small align-baseline text-decoration-none" onClick={() => navigate('/admin/templates')}>Template Management</Button>
                                </Form.Text>
                            </Col>
                            {selectedTemplateName !== 'Dock Audit' && (
                                <Col md={6}>
                                    <Form.Label className="small fw-bold">Machine Name / Line</Form.Label>
                                    <Form.Control
                                        placeholder="EY-LINE-1"
                                        value={scheduleData.machine_name}
                                        onChange={e => setScheduleData({ ...scheduleData, machine_name: e.target.value })}
                                        required
                                    />
                                </Col>
                            )}
                            <Col md={6}>
                                <Form.Label className="small fw-bold">Scheduled Date</Form.Label>
                                <Form.Control
                                    type="date"
                                    min={new Date().toISOString().split('T')[0]}
                                    value={scheduleData.audit_date}
                                    onChange={e => setScheduleData({ ...scheduleData, audit_date: e.target.value })}
                                    required
                                />
                            </Col>
                            <Col md={6}>
                                <Form.Label className="small fw-bold">Shift</Form.Label>
                                <Form.Select
                                    value={scheduleData.shift}
                                    onChange={e => setScheduleData({ ...scheduleData, shift: e.target.value })}
                                >
                                    <option value="A">Shift A</option>
                                    <option value="B">Shift B</option>
                                    <option value="C">Shift C</option>
                                </Form.Select>
                            </Col>
                        </Row>
                    </div>

                    {/* Section 2: Product & Process Details */}
                    <div className="mb-4 bg-light p-3 rounded shadow-sm border">
                        <h5 className="text-secondary fw-bold mb-3 d-flex align-items-center">
                            <span className="bg-secondary text-white rounded-circle me-2 d-inline-flex justify-content-center align-items-center" style={{ width: '22px', height: '22px', fontSize: '12px' }}>2</span>
                            Product & Process Details
                        </h5>
                        <hr className="mt-0 mb-3 opacity-25" />

                        {selectedTemplateName === 'Dock Audit' ? (
                            <Row className="g-3">
                                <Col md={6}>
                                    <Form.Label className="small fw-bold">Part Name (Product)</Form.Label>
                                    <Form.Select
                                        value={scheduleData.part_name}
                                        onChange={e => setScheduleData({ ...scheduleData, part_name: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Product...</option>
                                        {dockProducts.map(p => <option key={p} value={p}>{p}</option>)}
                                    </Form.Select>
                                </Col>
                                <Col md={6}>
                                    <Form.Label className="small fw-bold">Part Number</Form.Label>
                                    <Form.Control
                                        placeholder="PN-12345"
                                        value={scheduleData.part_number}
                                        onChange={e => setScheduleData({ ...scheduleData, part_number: e.target.value })}
                                        required
                                    />
                                </Col>
                                <Col md={3}>
                                    <Form.Label className="small fw-bold">Series</Form.Label>
                                    <Form.Control
                                        placeholder="Rev-00"
                                        value={scheduleData.series}
                                        onChange={e => setScheduleData({ ...scheduleData, series: e.target.value })}
                                        required
                                    />
                                </Col>
                                <Col md={3}>
                                    <Form.Label className="small fw-bold">Invoice No.</Form.Label>
                                    <Form.Control
                                        placeholder="QF/QA/134"
                                        value={scheduleData.invoice_no}
                                        onChange={e => setScheduleData({ ...scheduleData, invoice_no: e.target.value })}
                                        required
                                    />
                                </Col>
                                <Col md={3}>
                                    <Form.Label className="small fw-bold">Doc No.</Form.Label>
                                    <Form.Control
                                        placeholder="Dated: 27-07-2024"
                                        value={scheduleData.doc_no}
                                        onChange={e => setScheduleData({ ...scheduleData, doc_no: e.target.value })}
                                        required
                                    />
                                </Col>
                                <Col md={3}>
                                    <Form.Label className="small fw-bold">Qty. Audited</Form.Label>
                                    <Form.Control
                                        placeholder="100"
                                        value={scheduleData.qty_audited}
                                        onChange={e => setScheduleData({ ...scheduleData, qty_audited: e.target.value })}
                                        required
                                    />
                                </Col>
                            </Row>
                        ) : (
                            <Row className="g-3">
                                <Col md={4}>
                                    <Form.Label className="small fw-bold">Part Name (Product)</Form.Label>
                                    <Form.Select
                                        value={scheduleData.part_name}
                                        onChange={e => setScheduleData({ ...scheduleData, part_name: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Product...</option>
                                        {mfgProducts.map(p => <option key={p} value={p}>{p}</option>)}
                                    </Form.Select>
                                </Col>
                                <Col md={4}>
                                    <Form.Label className="small fw-bold">Operation</Form.Label>
                                    <Form.Control
                                        placeholder="Assembly"
                                        value={scheduleData.operation}
                                        onChange={e => setScheduleData({ ...scheduleData, operation: e.target.value })}
                                        required
                                    />
                                </Col>
                                <Col md={4}>
                                    <Form.Label className="small fw-bold">Part Number</Form.Label>
                                    <Form.Control
                                        placeholder="PN-12345"
                                        value={scheduleData.part_number}
                                        onChange={e => setScheduleData({ ...scheduleData, part_number: e.target.value })}
                                        required
                                    />
                                </Col>
                                <Col md={4}>
                                    <Form.Label className="small fw-bold">Manufacturing Process</Form.Label>
                                    <Form.Select
                                        value={scheduleData.process}
                                        onChange={e => setScheduleData({ ...scheduleData, process: e.target.value })}
                                        required
                                    >
                                        <option value="">Select Process...</option>
                                        {mfgProcesses.map(p => <option key={p} value={p}>{p}</option>)}
                                    </Form.Select>
                                </Col>
                            </Row>
                        )}
                    </div>

                    {/* Section 3: Personnel Assignment */}
                    <div className="mb-4">
                        <h5 className="text-success fw-bold mb-3 d-flex align-items-center">
                            <span className="bg-success text-white rounded-circle me-2 d-inline-flex justify-content-center align-items-center" style={{ width: '22px', height: '22px', fontSize: '12px' }}>3</span>
                            Personnel Assignment
                        </h5>
                        <hr className="mt-0 mb-3 opacity-25" />
                        <Row className="g-3">
                            <Col md={4}>
                                <Form.Label className="small fw-bold">Assign L1 (Inspector)</Form.Label>
                                <Form.Select
                                    required
                                    value={scheduleData.l1_auditor_id}
                                    onChange={e => setScheduleData({ ...scheduleData, l1_auditor_id: e.target.value })}
                                >
                                    <option value="">Select L1...</option>
                                    {getByRole('L1_Auditor').map((u: any) => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
                                </Form.Select>
                            </Col>
                            <Col md={4}>
                                <Form.Label className="small fw-bold">Assign Process Owner</Form.Label>
                                <Form.Select
                                    required
                                    value={scheduleData.process_owner_id}
                                    onChange={e => setScheduleData({ ...scheduleData, process_owner_id: e.target.value })}
                                >
                                    <option value="">Select Owner...</option>
                                    {/* Strictly show only Process Owners here */}
                                    {users.filter(u => u.role === 'Process_Owner').map((u: any) => (
                                        <option key={u.user_id} value={u.user_id}>{u.full_name}</option>
                                    ))}
                                </Form.Select>
                            </Col>
                            <Col md={4}>
                                <Form.Label className="small fw-bold">Assign L2 (Approver)</Form.Label>
                                <Form.Select
                                    required
                                    value={scheduleData.l2_auditor_id}
                                    onChange={e => setScheduleData({ ...scheduleData, l2_auditor_id: e.target.value })}
                                >
                                    <option value="">Select L2...</option>
                                    {getByRole('L2_Auditor').map((u: any) => <option key={u.user_id} value={u.user_id}>{u.full_name}</option>)}
                                </Form.Select>
                            </Col>
                        </Row>
                    </div>

                    <div className="mt-4 d-flex flex-column flex-sm-row justify-content-end align-items-center gap-3 border-top pt-4">
                        <Button variant="light" className="px-4 border fw-medium" onClick={() => navigate('/admin/dashboard')}>Cancel</Button>
                        <Button type="submit" variant="primary" className="px-5 fw-bold shadow-sm">Confirm & Schedule</Button>
                    </div>
                </Form>
            </Card>

            {/* Question Editor Modal */}
            <Modal show={showQuestionModal} onHide={() => setShowQuestionModal(false)} size="xl">
                <Modal.Header closeButton><Modal.Title>Edit Template Questions</Modal.Title></Modal.Header>
                <Modal.Body>
                    {selectedTemplateQuestions.length === 0 && (
                        <div className="text-muted p-3">No sections loaded. Please select a template first.</div>
                    )}

                    {selectedTemplateQuestions.map((sec: any) => (
                        <Card key={sec.section_id} className="mb-4 shadow-sm border-0">
                            <Card.Header className="bg-light fw-bold d-flex justify-content-between align-items-center">
                                <span>{sec.section_name}</span>
                                <Badge bg="secondary">{sec.questions?.length || 0} Questions</Badge>
                            </Card.Header>
                            <Card.Body className="p-0">
                                <Table striped hover responsive className="mb-0 align-middle">
                                    <thead>
                                        <tr>
                                            <th style={{ width: '5%' }}>#</th>
                                            <th>Question Text</th>
                                            <th style={{ width: '100px' }} className="text-center">Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {(sec.questions || []).map((q: any, idx: number) => (
                                            <tr key={q.question_id}>
                                                <td className="text-center text-muted">{idx + 1}</td>
                                                <td>
                                                    <Form.Control
                                                        defaultValue={q.question_text}
                                                        onBlur={(e) => {
                                                            if (e.target.value !== q.question_text) {
                                                                handleUpdateQuestion(q.question_id, e.target.value, q.input_type || 'standard');
                                                            }
                                                        }}
                                                    />
                                                </td>

                                                <td className="text-center">
                                                    <Button
                                                        size="sm"
                                                        variant="outline-danger"
                                                        onClick={() => setQuestionToDelete(q.question_id)}
                                                    >
                                                        Remove
                                                    </Button>
                                                </td>
                                            </tr>
                                        ))}
                                        {sec.questions && sec.questions.length === 0 && (
                                            <tr><td colSpan={4} className="text-center text-muted py-3">No questions in this section yet.</td></tr>
                                        )}
                                    </tbody>
                                </Table>
                            </Card.Body>
                            <Card.Footer className="bg-white border-top-0">
                                <Button
                                    size="sm"
                                    variant="outline-primary"
                                    onClick={() => setSectionToAddQuestion({
                                        sectionId: sec.section_id,
                                        order: (sec.questions?.length || 0) + 1
                                    })}
                                >
                                    + Add Question
                                </Button>
                            </Card.Footer>
                        </Card>
                    ))}
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="secondary" onClick={() => setShowQuestionModal(false)}>Close</Button>
                </Modal.Footer>
            </Modal>

            {/* Confirmation Modal */}
            <ConfirmationModal
                show={!!questionToDelete}
                onClose={() => setQuestionToDelete(null)}
                onConfirm={() => {
                    if (questionToDelete) handleDeleteQuestion(questionToDelete);
                    setQuestionToDelete(null);
                }}
                title="Delete Question"
                message="Are you sure you want to delete this question?"
                confirmText="Delete"
                variant="danger"
            />

            {/* Prompt Modal */}
            <PromptModal
                show={!!sectionToAddQuestion}
                onClose={() => setSectionToAddQuestion(null)}
                onSubmit={(text) => {
                    if (sectionToAddQuestion) {
                        handleAddQuestion(sectionToAddQuestion.sectionId, text, sectionToAddQuestion.order);
                    }
                }}
                title="Add New Question"
                label="Question Text"
                confirmText="Add Question"
            />
        </Container>
    );
};

export default ScheduleAudit;
