import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext.tsx'; // Import Auth
import { Container, Card, Nav, Button, Modal, Form, Badge, Alert } from 'react-bootstrap';
import { toast } from 'react-toastify';
import { FaTimes, FaCheckDouble } from 'react-icons/fa';
import ChecklistTab from '../../components/audit/tabs/ChecklistTab';
import ObjectivesTab from '../../components/audit/tabs/ObjectivesTab';
import CalibrationTab from '../../components/audit/tabs/CalibrationTab';
import ParametersTab from '../../components/audit/tabs/ParametersTab';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import Skeleton from '../../components/common/Skeleton';

const AuditWorkspace = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth(); // Get current user

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('checklist');
  const [auditData, setAuditData] = useState<any>(null);

  // L2 Rejection State
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');

  // Confirmation State
  const [confirmAction, setConfirmAction] = useState<'submit' | 'approve' | null>(null);

  const fetchAudit = async () => {
    try {
      const res = await api.get(`/audits/${id}/full`);
      setAuditData(res.data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || err.message || 'Failed to load audit.');
      setLoading(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAudit(); }, [id]);

  // --- ACTIONS ---

  const handleSubmitToL2 = async () => {
    try {
      await api.post(`/audits/${id}/submit-l2`);
      toast.success("Submitted to L2 successfully");
      navigate('/l1/tasks');
    } catch (err: any) { toast.error(err.response?.data?.error || "Submission failed"); }
  };

  const handleL2Approve = async () => {
    try {
      await api.put(`/audits/${id}/approve`);
      toast.success("Audit Approved & Closed!");
      navigate('/l2/inbox');
    } catch (err: any) { toast.error(err.response?.data?.error || "Approval failed"); }
  };

  const handleL2Reject = async () => {
    try {
      await api.put(`/audits/${id}/reject`, { reason: rejectReason });
      toast.success("Audit Rejected. Sent back to L1.");
      navigate('/l2/inbox');
    } catch (err: any) { toast.error(err.response?.data?.error || "Rejection failed"); }
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

  if (error) {
    return (
      <Container className="py-5 text-center fade-in">
        <div className="bg-danger bg-opacity-10 text-danger p-4 rounded-4 d-inline-block mb-4">
          <h3 className="fw-bold mb-1">System Obstruction</h3>
          <p className="mb-0 opacity-75">{error}</p>
        </div>
        <br />
        <Button variant="white" className="border shadow-sm px-4" onClick={() => navigate(-1)}>
          Return to Command Center
        </Button>
      </Container>
    );
  }

  // --- PERMISSIONS LOGIC ---
  const isL1 = user?.role === 'L1_Auditor' || user?.role === 'Admin';
  const isL2 = user?.role === 'L2_Auditor' || user?.role === 'Admin';

  // L1 can edit if status is Assigned, In_Progress, NC_Open, or Rejected
  // L2 can edit SCORES only if Submitted_to_L2
  const isReadOnly = !(isL1 && ['Assigned', 'In_Progress', 'NC_Open', 'Rejected'].includes(auditData.audit.status));
  const isScoringMode = isL2 && auditData.audit.status === 'Submitted_to_L2';

  return (
    <Container fluid className="py-4 fade-in">
      <div className="d-flex flex-column flex-lg-row justify-content-between align-items-stretch gap-3 mb-4">
        <div className="flex-grow-1">
          {auditData.audit.template_name === 'Dock Audit' ? (
            /* --- DOCK AUDIT HEADER (Premium Format) --- */
            <Card className="border-0 shadow-sm glass-panel overflow-hidden hover-lift transition-all">
              <div style={{ height: '4px', background: 'linear-gradient(90deg, #6366f1, #10b981)' }}></div>
              <Card.Body className="p-0">
                <div className="px-2 py-1 border-bottom d-flex align-items-center justify-content-between bg-white bg-opacity-50">
                  <h4 className="fw-bold m-0 text-gradient-indigo text-uppercase tracking-tight" style={{ fontSize: '0.75rem' }}>Product Integrity Protocol</h4>
                  <Badge pill bg="indigo-light" className="px-2 py-1 x-small border border-indigo-subtle" style={{ backgroundColor: 'rgba(99, 102, 241, 0.1)', color: '#6366f1', fontSize: '0.6rem' }}>
                    REF: {auditData.audit.audit_id}
                  </Badge>
                </div>
                <div className="row g-0 bg-white border-bottom border-light overflow-hidden">
                  <div className="col-6 col-md-2 border-end border-bottom border-light">
                    <div className="header-info-box primary" style={{ padding: '0.4rem 0.6rem' }}>
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.55rem' }}>Nomenclature</small>
                      <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.75rem' }}>{auditData.audit.part_name || '-'}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2 border-end border-bottom border-light">
                    <div className="header-info-box info" style={{ padding: '0.4rem 0.6rem' }}>
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.55rem' }}>Serial/Batch</small>
                      <div className="fw-bold text-dark text-uppercase text-truncate" style={{ fontSize: '0.75rem' }}>{auditData.audit.part_number || '-'}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2 border-end border-bottom border-light">
                    <div className="header-info-box success" style={{ padding: '0.4rem 0.6rem' }}>
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.55rem' }}>Timeline</small>
                      <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.75rem' }}>{new Date(auditData.audit.audit_date).toLocaleDateString(undefined, { dateStyle: 'medium' })}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2 border-end-md border-bottom border-light">
                    <div className="header-info-box warning" style={{ padding: '0.4rem 0.6rem' }}>
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.55rem' }}>Series/Shift</small>
                      <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.75rem' }}>{auditData.audit.series || '-'} / {auditData.audit.shift}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2 border-end border-light">
                    <div className="header-info-box danger" style={{ padding: '0.4rem 0.6rem' }}>
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.55rem' }}>Insp. Vol.</small>
                      <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.75rem' }}>{auditData.audit.qty_audited || '-'} Units</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2">
                    <div className="header-info-box primary" style={{ padding: '0.4rem 0.6rem' }}>
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.55rem' }}>Auditor</small>
                      <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.75rem' }}>{auditData.audit.l1_auditor_name}</div>
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
                <div className="px-2 py-1 border-bottom d-flex align-items-center justify-content-between bg-white bg-opacity-50">
                  <h4 className="fw-bold m-0 text-gradient-indigo text-uppercase tracking-tight" style={{ fontSize: '0.75rem' }}>{auditData.audit.template_name}</h4>
                  <Badge bg="success" pill className="px-2 py-1 x-small border border-success border-opacity-25 shadow-xs" style={{ fontSize: '0.6rem' }}>ACTIVE</Badge>
                </div>
                <div className="row g-0 bg-white border-bottom border-light overflow-hidden">
                  <div className="col-6 col-md-2 border-end border-bottom border-light">
                    <div className="header-info-box primary" style={{ padding: '0.4rem 0.6rem' }}>
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.55rem' }}>Unit</small>
                      <div className="fw-bold text-dark" style={{ fontSize: '0.75rem' }}>{auditData.audit.machine_name}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2 border-end border-bottom border-light">
                    <div className="header-info-box info" style={{ padding: '0.4rem 0.6rem' }}>
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.55rem' }}>Phase</small>
                      <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.75rem' }}>{auditData.audit.operation || 'GEN'}</div>
                    </div>
                  </div>
                  <div className="col-12 col-md-3 border-end border-bottom border-light bg-light bg-opacity-10">
                    <div className="header-info-box danger" style={{ padding: '0.4rem 0.6rem' }}>
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.55rem' }}>Process</small>
                      <div className="fw-bold text-danger text-truncate" style={{ fontSize: '0.75rem' }}>{auditData.audit.process || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-2 border-end border-light">
                    <div className="header-info-box warning" style={{ padding: '0.4rem 0.6rem' }}>
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.55rem' }}>Component</small>
                      <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.75rem' }}>{auditData.audit.part_name || 'N/A'}</div>
                    </div>
                  </div>
                  <div className="col-6 col-md-3">
                    <div className="header-info-box success" style={{ padding: '0.4rem 0.6rem' }}>
                      <small className="text-muted text-uppercase fw-bold d-block mb-1 tracking-widest" style={{ fontSize: '0.55rem' }}>Auditor</small>
                      <div className="fw-bold text-dark text-truncate" style={{ fontSize: '0.75rem' }}>{auditData.audit.l1_auditor_name}</div>
                    </div>
                  </div>
                </div>
              </Card.Body>
            </Card>
          )}
        </div>
        <div className="d-flex flex-column gap-2 justify-content-center min-w-md-200">
          {/* L2 Action Buttons */}
          {isScoringMode && (
            <>
              <Button variant="danger" className="w-100 fw-bold py-2 shadow-sm" onClick={() => setShowRejectModal(true)}>
                <FaTimes /> Reject Audit
              </Button>
              <Button variant="success" className="w-100 fw-bold py-2 shadow-sm" onClick={() => setConfirmAction('approve')}>
                <FaCheckDouble /> Approve
              </Button>
            </>
          )}
          <Button variant="white" className="w-100 py-2 border shadow-sm" onClick={() => navigate(-1)}>
            <i className="bi bi-arrow-left me-2"></i> Exit Workspace
          </Button>
        </div>
      </div>

      {auditData.audit.status === 'Rejected' && auditData.rejection_reason && (
        <Alert variant="danger" className="mb-4 border-0 shadow-sm rounded-4 d-flex align-items-center">
          <div className="me-3 fs-3">⚠️</div>
          <div>
            <h6 className="fw-bold mb-1">Audit Rejected by L2</h6>
            <p className="mb-0 opacity-75">{auditData.rejection_reason}</p>
          </div>
        </Alert>
      )}

      <Card className="shadow-sm border-0">
        <Card.Header className="bg-white">
          <Nav variant="tabs" activeKey={activeTab} onSelect={(k) => setActiveTab(k || 'checklist')}>
            <Nav.Item><Nav.Link eventKey="checklist" className="text-dark">1. Checklist {isScoringMode && "(Scoring)"}</Nav.Link></Nav.Item>

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
              ncs={auditData.data.ncs} // Pass NCs
              onRefresh={fetchAudit}
              readOnly={isReadOnly}
              scoringMode={isScoringMode}
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
              readOnly={isReadOnly}
              scoringMode={isScoringMode}
              // Only show "Product Audit" section
              sectionFilter={s => s.includes("Product Audit")}
            />
          )}

          {/* Pass readOnly to other tabs to disable inputs for L2 */}
          {activeTab === 'objectives' && auditData.audit.template_name !== 'Dock Audit' && (
            <ObjectivesTab
              auditId={id!}
              initialData={auditData.data.objectives}
              ncs={auditData.data.ncs} // Pass NCs
              readOnly={isReadOnly}
              onRefresh={fetchAudit}
            />
          )}
          {activeTab === 'calibration' && auditData.audit.template_name !== 'Dock Audit' && (
            <CalibrationTab
              auditId={id!}
              initialData={auditData.data.calibrations}
              ncs={auditData.data.ncs} // Pass NCs
              readOnly={isReadOnly}
              onRefresh={fetchAudit}
            />
          )}
          {activeTab === 'parameters' && auditData.audit.template_name !== 'Dock Audit' && (
            <ParametersTab
              auditId={id!}
              initialData={auditData.data.parameters}
              ncs={auditData.data.ncs} // Pass NCs
              readOnly={isReadOnly}
              onRefresh={fetchAudit}
            />
          )}
        </Card.Body>

        {/* L1 Submit Button (Existing) */}
        {isL1 && !isReadOnly && (
          <Card.Footer className="bg-light d-flex justify-content-end">
            <Button
              variant="primary"
              onClick={() => setConfirmAction('submit')}
              disabled={auditData.audit.status === 'NC_Open' || auditData.audit.status === 'NC_Pending_Verify'}
            >
              Submit to L2 Auditor
            </Button>
          </Card.Footer>
        )}
      </Card>

      {/* Reject Modal */}
      <Modal show={showRejectModal} onHide={() => setShowRejectModal(false)}>
        <Modal.Header closeButton><Modal.Title>Reject Audit</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group>
            <Form.Label>Reason for Rejection</Form.Label>
            <Form.Control as="textarea" rows={3} value={rejectReason} onChange={e => setRejectReason(e.target.value)} />
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="danger" onClick={handleL2Reject}>Confirm Rejection</Button>
        </Modal.Footer>
      </Modal>

      {/* Confirmation Modal */}
      <ConfirmationModal
        show={!!confirmAction}
        onClose={() => setConfirmAction(null)}
        onConfirm={() => {
          if (confirmAction === 'submit') handleSubmitToL2();
          if (confirmAction === 'approve') handleL2Approve();
          setConfirmAction(null);
        }}
        title={confirmAction === 'submit' ? "Submit Audit" : "Approve Audit"}
        message={
          confirmAction === 'submit'
            ? "Submit to L2 for grading?"
            : "Approve and Close this Audit? This is final."
        }
        confirmText={confirmAction === 'submit' ? "Submit" : "Approve"}
        variant="primary"
      />
    </Container>
  );
};

export default AuditWorkspace;