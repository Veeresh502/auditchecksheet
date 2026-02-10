import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Container, Card, Form, Button, Row, Col, Alert, Spinner, Badge } from 'react-bootstrap';
import { FaArrowLeft, FaCheck } from 'react-icons/fa';
import api from '../../api/axios';
import FilePreview from '../../components/common/FilePreview';
import { toast } from 'react-toastify';

const NCResolution = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [ncData, setNcData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Form State
  const [rootCause, setRootCause] = useState('');
  const [correctiveAction, setCorrectiveAction] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const res = await api.get(`/nc/${id}`);
        setNcData(res.data);
      } catch (err) {
        toast.error("Error fetching NC details");
        navigate('/owner/tasks');
      } finally {
        setLoading(false);
      }
    };
    fetchDetails();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rootCause || !correctiveAction)
      return toast.warning("Please fill all fields");

    setSubmitting(true);
    try {
      let evidenceUrl = null;

      // -----------------------------
      // 1. UPLOAD FILE + SHOW PREVIEW
      // -----------------------------
      if (file) {
        const formData = new FormData();
        formData.append('file', file);

        const uploadRes = await api.post('/upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });

        evidenceUrl = uploadRes.data.url;
        setPreviewUrl(evidenceUrl);
      }

      // -----------------------------
      // 2. SUBMIT NC RESOLUTION
      // -----------------------------
      await api.post(`/nc/${id}/resolve`, {
        root_cause: rootCause,
        corrective_action: correctiveAction,
        evidence_url: evidenceUrl
      });

      toast.success("Resolution Submitted! Sent to L1 for verification.");
      navigate('/owner/tasks');

    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to submit");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading)
    return <div className="text-center mt-5"><Spinner animation="border" /></div>;

  return (
    <Container className="py-4" style={{ maxWidth: '800px' }}>
      <Button variant="link" className="text-decoration-none mb-3 ps-0"
        onClick={() => navigate('/owner/tasks')}>
        <FaArrowLeft /> Back to List
      </Button>

      {/* NC DETAILS */}
      <Card className="border-0 shadow-sm glass-panel overflow-hidden hover-lift transition-all mb-4">
        <div style={{ height: '4px', background: 'linear-gradient(90deg, #ef4444, #f59e0b)' }}></div>
        <Card.Body className="p-0">
          <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between bg-white bg-opacity-50">
            <h5 className="fw-bold m-0 text-danger text-uppercase tracking-tight">Non-Conformance Details</h5>
            <Badge bg="danger" pill className="px-3 border border-danger border-opacity-25 shadow-xs">URGENT ACTION</Badge>
          </div>
          <div className="p-4 bg-white">
            <Row className="g-4">
              <Col md={6}>
                <div className="header-info-box primary">
                  <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest x-small">Machine / Area</small>
                  <div className="fw-bold text-dark">{ncData.machine_name}</div>
                </div>
              </Col>
              <Col md={6}>
                <div className="header-info-box info">
                  <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest x-small">Date Raised</small>
                  <div className="fw-bold text-dark">{new Date(ncData.created_at).toLocaleDateString()}</div>
                </div>
              </Col>
              <Col md={12}>
                <div className="header-info-box danger bg-danger bg-opacity-10">
                  <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest x-small">Issue Description</small>
                  <div className="fw-bold text-danger">"{ncData.issue_description}"</div>
                </div>
              </Col>

              {ncData.issue_image_url && (
                <Col md={12}>
                  <div className="border rounded p-3 bg-light">
                    <small className="text-muted text-uppercase fw-bold d-block mb-2 tracking-widest x-small">Issue Evidence (Auditor Attached)</small>
                    <div style={{ maxWidth: '400px' }}>
                      <FilePreview fileUrl={ncData.issue_image_url} />
                    </div>
                  </div>
                </Col>
              )}
            </Row>
          </div>
        </Card.Body>
      </Card>

      {/* RESOLUTION FORM */}
      <Card className="shadow-sm border-0 rounded-4 overflow-hidden">
        <Card.Body className="p-4">
          <h5 className="mb-4 text-primary fw-bold d-flex align-items-center">
            <span className="bg-primary text-white rounded-circle me-2 d-inline-flex justify-content-center align-items-center" style={{ width: '24px', height: '24px', fontSize: '14px' }}>R</span>
            Corrective Action Plan
          </h5>

          <Form onSubmit={handleSubmit}>

            {/* ROOT CAUSE */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold small">1. Root Cause Analysis</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                className="border-light shadow-xs"
                placeholder="Why did this happen?"
                value={ncData.root_cause || rootCause}
                onChange={e => setRootCause(e.target.value)}
                required
                disabled={ncData.status !== 'Open'}
              />
            </Form.Group>

            {/* CORRECTIVE ACTION */}
            <Form.Group className="mb-3">
              <Form.Label className="fw-bold small">2. Corrective Action Taken</Form.Label>
              <Form.Control
                as="textarea"
                rows={3}
                className="border-light shadow-xs"
                placeholder="What did you do to fix it?"
                value={ncData.corrective_action || correctiveAction}
                onChange={e => setCorrectiveAction(e.target.value)}
                required
                disabled={ncData.status !== 'Open'}
              />
            </Form.Group>

            {/* EVIDENCE UPLOAD + PREVIEW */}
            <Form.Group className="mb-4">
              <Form.Label className="fw-bold small">3. Evidence (Photo/Document)</Form.Label>
              <div className="border border-dashed rounded p-4 bg-light bg-opacity-50 text-center">

                {ncData.status === 'Open' && (
                  <Form.Control
                    type="file"
                    className="mb-2"
                    onChange={(e: any) => setFile(e.target.files[0])}
                  />
                )}

                {(previewUrl || ncData.evidence_url) && (
                  <div className="mt-3">
                    <FilePreview fileUrl={ncData.evidence_url || previewUrl} />
                  </div>
                )}

                {ncData.status === 'Open' && (
                  <Form.Text className="text-muted small d-block mt-2">
                    Optional but recommended. Upload proof of the fix.
                  </Form.Text>
                )}
              </div>
            </Form.Group>

            {/* SUBMIT BUTTON */}
            {ncData.status === 'Open' && (
              <div className="d-grid pt-3">
                <Button variant="success" size="lg" type="submit" className="fw-bold shadow-sm py-3" disabled={submitting}>
                  {submitting
                    ? <Spinner size="sm" animation="border" />
                    : <><FaCheck className="me-2" /> Submit for Verification</>}
                </Button>
              </div>
            )}
            {ncData.status !== 'Open' && (
              <Alert variant="info">
                This NC has been resolved and is currently <strong>{ncData.status}</strong>.
              </Alert>
            )}

          </Form>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default NCResolution;
