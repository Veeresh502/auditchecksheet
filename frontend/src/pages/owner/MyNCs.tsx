import { useState, useEffect } from 'react';
import { Container, Table, Button, Badge, Form, Card } from 'react-bootstrap';
import { FaSearch } from 'react-icons/fa';
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../api/axios';
import Skeleton from '../../components/common/Skeleton';

const MyNCs = () => {
  const [ncs, setNcs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') || 'active';
  const [searchTerm, setSearchTerm] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchNCs();
  }, [view]);

  const fetchNCs = async () => {
    setLoading(true);
    try {
      const endpoint = view === 'history' ? '/nc/my-tasks?view=history' : '/nc/my-tasks';
      const res = await api.get(endpoint);
      setNcs(res.data);
    } catch (err) {
      console.error("Failed to fetch NCs");
    } finally {
      setLoading(false);
    }
  };

  const filteredNCs = ncs.filter((nc: any) =>
    nc.machine_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    nc.issue_description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

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
          <h2 className="mb-0 fw-bold">My Non-Conformances</h2>
          <p className="text-muted">Manage and resolve NCs assigned to your areas.</p>
        </div>

        <div style={{ width: '300px' }}>
          <div className="position-relative">
            <FaSearch className="position-absolute text-muted" style={{ top: '50%', left: '12px', transform: 'translateY(-50%)', zIndex: 5 }} />
            <Form.Control
              className="search-input-premium ps-5 border-0"
              placeholder="Search NCs..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
        </div>
      </div>

      <Card className="shadow-sm border-0">
        <Card.Body className="p-0">
          <Table hover responsive className="mb-0 align-middle">
            <thead className="table-light">
              <tr>
                <th className="py-3 ps-4">Target Date</th>
                <th className="py-3">Description</th>
                <th className="py-3">Risk</th>
                <th className="py-3">Status</th>
                <th className="py-3 pe-4 text-center">Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredNCs.length > 0 ? (
                filteredNCs.map((nc: any) => (
                  <tr key={nc.nc_id}>
                    <td className="ps-4">{new Date(nc.target_date).toLocaleDateString()}</td>
                    <td>
                      <div className="d-flex align-items-center gap-2">
                        <div className="fw-bold text-dark text-truncate" style={{ maxWidth: '300px' }}>{nc.issue_description}</div>
                        {nc.issue_image_url && <Badge bg="light" text="dark" className="border shadow-sm"><i className="bi bi-camera-fill me-1"></i>Evidence</Badge>}
                      </div>
                      <div className="text-muted small">ID: {nc.nc_id}</div>
                    </td>
                    <td>
                      <Badge bg={nc.risk_level === 'High' ? 'danger' : nc.risk_level === 'Medium' ? 'warning' : 'info'}>
                        {nc.risk_level}
                      </Badge>
                    </td>
                    <td>
                      <Badge bg={nc.status === 'Resolved' ? 'success' : 'primary'} className="rounded-pill px-3">
                        {nc.status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                    <td className="pe-4 text-center">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={() => navigate(`/owner/resolve/${nc.nc_id}`)}
                      >
                        Details
                      </Button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={5} className="text-center py-5 text-muted">
                    No active NCs found.
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

export default MyNCs;