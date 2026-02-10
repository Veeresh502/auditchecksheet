import { useState, useEffect } from 'react';
import { Container, Table, Button, Badge, Form, Card } from 'react-bootstrap';
import { FaSearch, FaPaperclip } from 'react-icons/fa';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import Skeleton from '../../components/common/Skeleton';
import AuditEvidenceModal from '../../components/audit/AuditEvidenceModal';

const MyTasks = () => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') || 'active';
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  const [showEvidenceModal, setShowEvidenceModal] = useState(false);
  const [selectedAuditId, setSelectedAuditId] = useState<string | null>(null);

  useEffect(() => {
    fetchTasks();
  }, [view]);

  const fetchTasks = async () => {
    try {
      // Use the unified endpoint with query param
      const endpoint = `/audits/l1/my-tasks?view=${view}`;
      const res = await api.get(endpoint);
      setTasks(res.data);
    } catch (err) {
      console.error("Failed to fetch tasks");
    } finally {
      setLoading(false);
    }
  };

  const filteredTasks = tasks.filter((t: any) =>
    t.machine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    t.template_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleViewEvidence = (id: string) => {
    setSelectedAuditId(id);
    setShowEvidenceModal(true);
  };

  if (loading) {
    return (
      <Container className="py-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} height={100} className="mb-3" borderRadius="8px" />
        ))}
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0 fw-bold">
            {view === 'history' ? 'Audit History' : 'My Active Tasks'}
          </h2>
          <p className="text-muted">
            {view === 'history' ? 'View previously submitted audits.' : 'Tasks requiring your immediate attention.'}
          </p>
        </div>

        <div style={{ width: '300px' }}>
          <div className="position-relative">
            <FaSearch className="position-absolute text-muted" style={{ top: '50%', left: '12px', transform: 'translateY(-50%)', zIndex: 5 }} />
            <Form.Control
              className="search-input-premium ps-5 border-0"
              placeholder="Search..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Card className="dashboard-card border-0 mb-4">
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="table-premium-header">
              <tr>
                <th className="py-3 ps-4 border-0">Date</th>
                <th className="py-3 border-0">Machine</th>
                <th className="py-3 border-0">Template</th>
                <th className="py-3 border-0">Status</th>
                <th className="py-3 pe-4 text-center border-0">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredTasks.length > 0 ? (
                filteredTasks.map((task: any) => (
                  <tr key={task.audit_id} className="hover-row transition-all">
                    <td className="ps-4 text-nowrap py-3">
                      <div className="fw-bold text-dark">{new Date(task.audit_date).toLocaleDateString()}</div>
                    </td>
                    <td className="fw-bold text-dark py-3">
                      {task.machine_name}
                      {task.process && (
                        <div className="text-muted small fw-normal" style={{ fontSize: '0.75rem' }}>
                          Process: {task.process}
                        </div>
                      )}
                    </td>
                    <td className="text-muted small fw-medium py-3 text-uppercase">{task.template_name?.replace(' Audit', '')}</td>
                    <td className="py-3">
                      <Badge
                        bg="light" text="dark"
                        className={`badge-premium border-0 ${task.status === 'Completed' ? 'badge-success-subtle' :
                          task.status === 'NC_Open' ? 'badge-danger-subtle' :
                            task.status === 'Rejected' ? 'badge-danger-subtle' :
                              task.status === 'Submitted_to_L2' ? 'badge-warning-subtle' : 'badge-primary-subtle'
                          }`}
                      >
                        {task.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="pe-4 py-3">
                      <div className="d-flex justify-content-center gap-2">
                        <Button
                          variant={view === 'active' ? 'primary' : 'outline-primary'}
                          size="sm"
                          className="px-3 fw-bold shadow-sm"
                          onClick={() => navigate(`/l1/audit/${task.audit_id}`)}
                        >
                          {view === 'active' ? 'Start Audit' : 'View'}
                        </Button>

                        <Button
                          variant="outline-secondary"
                          size="sm"
                          className="border-0 bg-light text-muted"
                          title="View Evidence / Signatures"
                          onClick={() => handleViewEvidence(task.audit_id)}
                        >
                          <FaPaperclip />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted fw-medium">
                    <div className="d-flex flex-column align-items-center">
                      <div className="fs-1 mb-2">📭</div>
                      <div>No {view} tasks found.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>

      <AuditEvidenceModal
        show={showEvidenceModal}
        onHide={() => setShowEvidenceModal(false)}
        auditId={selectedAuditId}
      />
    </Container>
  );
};

export default MyTasks;