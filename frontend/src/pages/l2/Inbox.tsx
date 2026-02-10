import { useState, useEffect } from 'react';
import { Container, Table, Button, Badge, Form, Card } from 'react-bootstrap';
import { FaSearch } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import Skeleton from '../../components/common/Skeleton';

const Inbox = () => {
  const [audits, setAudits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [view, setView] = useState('active');
  const navigate = useNavigate();

  useEffect(() => {
    fetchAudits();
  }, [view]);

  const fetchAudits = async () => {
    setLoading(true);
    try {
      const res = await api.get(`/audits/l2/inbox?view=${view}`);
      setAudits(res.data);
    } catch (err) {
      console.error("Failed to fetch inbox");
    } finally {
      setLoading(false);
    }
  };

  const filteredAudits = audits.filter((a: any) =>
    a.machine_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.l1_auditor_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <Container className="py-4">
        <div className="mb-4">
          <Skeleton width={200} height={32} className="mb-2" />
          <Skeleton width={300} height={18} />
        </div>
        <Card className="border-0 shadow-sm">
          <Card.Body className="p-4">
            {[1, 2, 3, 4, 5].map(i => (
              <Skeleton key={i} height={40} className="mb-2" />
            ))}
          </Card.Body>
        </Card>
      </Container>
    );
  }

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 className="mb-0 fw-bold">
            {view === 'history' ? 'Audit History' : 'Review Inbox'}
          </h2>
          <p className="text-muted">
            {view === 'history' ? 'View previously approved/completed audits.' : 'Review and score audits submitted by the field teams.'}
          </p>
        </div>

        <div className="d-flex align-items-center gap-3">
          <div className="btn-group shadow-sm bg-white p-1 rounded-3">
            <Button
              variant={view === 'active' ? 'primary' : 'white'}
              size="sm"
              className="rounded-2 px-3"
              onClick={() => setView('active')}
            >
              Active
            </Button>
            <Button
              variant={view === 'history' ? 'primary' : 'white'}
              size="sm"
              className="rounded-2 px-3"
              onClick={() => setView('history')}
            >
              History
            </Button>
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
      </div>

      <Card className="dashboard-card border-0 mb-4">
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="table-premium-header">
              <tr>
                <th className="py-3 ps-4 border-0">Date</th>
                <th className="py-3 border-0">Machine</th>
                <th className="py-3 border-0">L1 Auditor</th>
                <th className="py-3 border-0">Status</th>
                <th className="py-3 pe-4 text-center border-0">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAudits.length > 0 ? (
                filteredAudits.map((audit: any) => (
                  <tr key={audit.audit_id} className="hover-row transition-all">
                    <td className="ps-4 text-nowrap py-3">
                      <div className="fw-bold text-dark">{new Date(audit.audit_date).toLocaleDateString()}</div>
                    </td>
                    <td className="fw-bold text-primary py-3">{audit.machine_name}</td>
                    <td className="text-muted small fw-medium py-3">{audit.l1_auditor_name || 'N/A'}</td>
                    <td className="py-3">
                      <Badge
                        bg="light" text="dark"
                        className={`badge-premium border-0 ${audit.status === 'Completed' ? 'badge-success-subtle' :
                          audit.status === 'Submitted_to_L2' ? 'badge-warning-subtle' :
                            audit.status === 'Rejected' ? 'badge-danger-subtle' : 'badge-primary-subtle'
                          }`}
                      >
                        {audit.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="pe-4 text-center py-3">
                      <Button
                        variant={view === 'active' ? 'primary' : 'outline-primary'}
                        size="sm"
                        className="px-4 fw-bold shadow-sm"
                        onClick={() => navigate(`/l2/audit/${audit.audit_id}`)}
                      >
                        {view === 'active' ? 'Review' : 'View'}
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted fw-medium">
                    <div className="d-flex flex-column align-items-center">
                      <div className="fs-1 mb-2">📥</div>
                      <div>No {view} audits found.</div>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </Table>
        </Card.Body>
      </Card>
    </Container>
  );
};

export default Inbox;