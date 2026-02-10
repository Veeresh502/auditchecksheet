import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { Container, Card, Nav, Button, Modal, Form, Badge } from 'react-bootstrap';
import { FaCheckCircle, FaTimesCircle, FaArrowLeft } from 'react-icons/fa';
import { toast } from 'react-toastify';
import ChecklistTab from '../../components/audit/tabs/ChecklistTab';
import ObjectivesTab from '../../components/audit/tabs/ObjectivesTab';
import CalibrationTab from '../../components/audit/tabs/CalibrationTab';
import ParametersTab from '../../components/audit/tabs/ParametersTab';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import Skeleton from '../../components/common/Skeleton';

const ScoringWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('checklist');
  const [auditData, setAuditData] = useState<any>(null);

  // Rejection State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Confirmation State
  const [showApproveConfirm, setShowApproveConfirm] = useState(false);

  const fetchAudit = async () => {
    try {
      const res = await api.get(`/audits/${id}/full`);
      setAuditData(res.data);
    } catch (err) {
      toast.error('Error loading audit');
      navigate('/l2/inbox');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudit(); }, [id]);

  const handleApprove = async () => {
    try {
      await api.put(`/audits/${id}/approve`);
      toast.success("Audit Approved Successfully!");
      navigate('/l2/inbox');
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Approval Failed");
    }
  };

  const handleReject = async () => {
    if (!rejectReason) return toast.warning("Please provide a reason.");
    try {
      await api.put(`/audits/${id}/reject`, { reason: rejectReason });
      toast.info("Audit Rejected and sent back to L1.");
      navigate('/l2/inbox');
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Rejection Failed");
    }
  };

  if (loading) {
    return (
      <Container fluid className="py-4 fade-in">
        <Skeleton height={150} borderRadius="1rem" className="mb-4" />
        <Card className="border-0 shadow-sm rounded-4">
          <Card.Header className="bg-white py-3 border-bottom d-flex gap-3">
            <Skeleton width={100} height={20} />
            <Skeleton width={100} height={20} />
          </Card.Header>
          <Card.Body>
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="mb-3 d-flex gap-3 align-items-center">
                <Skeleton width={30} height={30} borderRadius="50%" />
                <Skeleton height={20} />
              </div>
            ))}
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container fluid className="py-4 fade-in">
      <Button variant="link" className="text-decoration-none mb-3 ps-0" onClick={() => navigate('/l2/inbox')}>
        <FaArrowLeft /> Back to Inbox
      </Button>

      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-stretch gap-3 mb-4">
        <div className="flex-grow-1">
          {auditData.audit.template_name === 'Dock Audit' ? (
            /* --- DOCK AUDIT HEADER (Premium Format) --- */
            <Card className="border-0 shadow-sm glass-panel overflow-hidden hover-lift transition-all">
              <div style={{ height: '4px', background: 'linear-gradient(90deg, #6366f1, #10b981)' }}></div>
              <Card.Body className="p-0">
                <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between bg-white bg-opacity-50">
                  <h4 className="fw-bold m-0 text-gradient-indigo text-uppercase tracking-wider">Product Integrity Protocol</h4>
                  <Badge pill bg="indigo-light" className="px-3 py-2 text-indigo border border-indigo-subtle" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1' }}>
                    PROTOCOL REF: {auditData.audit.audit_id}
                  </Badge>
                </div>
                <div className="row g-0">
                  <div className="col-md-4 border-end border-light">
                    <div className="p-3 border-bottom border-light">
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.6rem' }}>Product Nomenclature</small>
                      <span className="fw-bold text-dark">{auditData.audit.part_name || '-'}</span>
                    </div>
                    <div className="p-3">
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.6rem' }}>Product Serial/Batch</small>
                      <span className="fw-bold text-dark text-uppercase">{auditData.audit.part_number || '-'}</span>
                    </div>
                  </div>
                  <div className="col-md-4 border-end border-light">
                    <div className="p-3 border-bottom border-light">
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.6rem' }}>Verification Timeline</small>
                      <span className="fw-bold text-dark">{new Date(auditData.audit.audit_date).toLocaleDateString(undefined, { dateStyle: 'long' })}</span>
                    </div>
                    <div className="p-3">
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.6rem' }}>Production Series</small>
                      <span className="fw-bold text-dark">{auditData.audit.series || '-'} / Shift: {auditData.audit.shift}</span>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="p-3 border-bottom border-light">
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.6rem' }}>Inspection Vol.</small>
                      <span className="fw-bold text-dark">{auditData.audit.qty_audited || '-'} Units Audited</span>
                    </div>
                    <div className="p-3">
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.6rem' }}>Authorized Auditor</small>
                      <span className="fw-bold text-dark">{auditData.audit.l1_auditor_name}</span>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          ) : (
            /* --- STANDARD HEADER (Manufacturing) --- */
            <Card className="border-0 shadow-sm glass-panel overflow-hidden hover-lift transition-all">
              <div style={{ height: '4px', background: 'linear-gradient(90deg, #10b981, #3b82f6)' }}></div>
              <Card.Body className="p-0">
                <div className="px-4 py-3 border-bottom d-flex align-items-center justify-content-between bg-white bg-opacity-50">
                  <h4 className="fw-bold m-0 text-gradient-indigo text-uppercase tracking-tight">{auditData.audit.template_name} Verification</h4>
                  <div className="d-flex gap-2">
                    <Badge bg="success" pill className="px-3 border border-success border-opacity-25 shadow-xs">ACTIVE SESSION</Badge>
                  </div>
                </div>
                <div className="row g-0 bg-white border-bottom border-light overflow-hidden">
                  <div className="col-6 col-md-2 border-end border-light">
                    <div className="header-info-box primary">
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest x-small">Operational Unit</small>
                      <div className="fw-bold text-dark">{auditData.audit.machine_name}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2 border-end border-light">
                    <div className="header-info-box info">
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest x-small">Process Phase</small>
                      <div className="fw-bold text-dark text-truncate">{auditData.audit.operation || 'GENERAL'}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-3 border-end border-light bg-light bg-opacity-10">
                    <div className="header-info-box danger">
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest x-small">Manufacturing Process</small>
                      <div className="fw-bold text-danger text-truncate">{auditData.audit.process || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2 border-end border-light">
                    <div className="header-info-box warning">
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest x-small">Component</small>
                      <div className="fw-bold text-dark text-truncate">{auditData.audit.part_name || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="header-info-box success">
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest x-small">Lead Command</small>
                      <div className="fw-bold text-dark text-truncate">{auditData.audit.l1_auditor_name}</div>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}
        </div>
        <div className="d-flex flex-column gap-2 justify-content-center min-w-md-200">
          <Button variant="danger" className="w-100 fw-bold py-2 shadow-sm" onClick={() => setShowRejectModal(true)}>
            <FaTimesCircle className="me-2" /> Reject Audit
          </Button>
          <Button variant="success" className="w-100 fw-bold py-2 shadow-sm" onClick={() => setShowApproveConfirm(true)}>
            <FaCheckCircle className="me-2" /> Approve & Close
          </Button>
          <Button variant="white" className="w-100 py-2 border shadow-sm" onClick={() => navigate('/l2/inbox')}>
            <FaArrowLeft className="me-2" /> Exit Workspace
          </Button>
        </div>
      </div>

      <Card className="shadow-sm border-0">
        <Card.Header className="bg-white">
          <Nav variant="tabs" activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'checklist')}>
            <Nav.Item><Nav.Link eventKey="checklist" className="text-dark">1. Checklist (Grading)</Nav.Link></Nav.Item>

            {/* Dock Audit Specific Tabs */}
            {auditData.audit.template_name === 'Dock Audit' && (
              <Nav.Item><Nav.Link eventKey="product_audit" className="text-dark">2. Product Audit</Nav.Link></Nav.Item>
            )}

            {/* Only show additional tabs for Manufacturing audits, not Dock Audit */}
            {auditData.audit.template_name !== 'Dock Audit' && (
              <>
                <Nav.Item><Nav.Link eventKey="objectives" className="text-dark">2. Objectives</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="calibration" className="text-dark">3. Calibration</Nav.Link></Nav.Item>
                <Nav.Item><Nav.Link eventKey="parameters" className="text-dark">4. Parameters</Nav.Link></Nav.Item>
              </>
            )}
          </Nav>
        </Card.Header>
        <Card.Body>
          {activeTab === 'checklist' && (
            <ChecklistTab
              auditId={id!}
              initialData={auditData.data.checklist}
              ncs={auditData.data.ncs}
              onRefresh={fetchAudit}
              readOnly={true}      // L2 cannot edit observations
              scoringMode={true}   // L2 CAN see Score Buttons
              // For Dock Audit, exclude "Product Audit" section from this tab
              sectionFilter={auditData.audit.template_name === 'Dock Audit' ? s => !s.includes("Product Audit") : undefined}
            />
          )}

          {activeTab === 'product_audit' && auditData.audit.template_name === 'Dock Audit' && (
            <ChecklistTab
              auditId={id!}
              initialData={auditData.data.checklist}
              ncs={auditData.data.ncs}
              onRefresh={fetchAudit}
              readOnly={true}
              scoringMode={true}
              // Only show "Product Audit" section
              sectionFilter={s => s.includes("Product Audit")}
            />
          )}

          {/* Other tabs are purely Read-Only for L2 */}
          {activeTab === 'objectives' && auditData.audit.template_name !== 'Dock Audit' && <ObjectivesTab auditId={id!} initialData={auditData.data.objectives} ncs={auditData.data.ncs} readOnly={true} onRefresh={() => { }} />}
          {activeTab === 'calibration' && auditData.audit.template_name !== 'Dock Audit' && <CalibrationTab auditId={id!} initialData={auditData.data.calibrations} ncs={auditData.data.ncs} readOnly={true} onRefresh={() => { }} />}
          {activeTab === 'parameters' && auditData.audit.template_name !== 'Dock Audit' && <ParametersTab auditId={id!} initialData={auditData.data.parameters} ncs={auditData.data.ncs} readOnly={true} onRefresh={() => { }} />}
        </Card.Body>
      </Card>

      {/* Reject Modal */}
      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)}>
        <Modal.Header closeButton className="bg-danger text-white">
          <Modal.Title>Reject Audit</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p>This will send the audit back to the L1 Auditor for corrections.</p>
          <Form.Group>
            <Form.Label className="fw-bold">Reason for Rejection</Form.Label>
            <Form.Control
              as="textarea"
              rows={3}
              value={rejectReason}
              onChange={e => setRejectReason(e.target.value)}
              placeholder="Missing calibration data..."
            />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowRejectModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleReject}>Confirm Rejection</Button>
        </Modal.Footer>
      </Modal>

      {/* Approve Confirmation Modal */}
      <ConfirmationModal
        show={showApproveConfirm}
        onClose={() => setShowApproveConfirm(false)}
        onConfirm={() => {
          handleApprove();
          setShowApproveConfirm(false);
        }}
        title="Approve Audit"
        message="Are you sure you want to Approve this audit? This will lock the scores permanently."
        confirmText="Approve"
        variant="success"
      />
    </Container>
  );
};

export default ScoringWorkspace;