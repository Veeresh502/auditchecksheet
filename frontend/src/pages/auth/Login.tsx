import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { Container, Card, Form, Button, Alert, Spinner } from 'react-bootstrap';


const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await api.post('/auth/login', { email, password });
      login(res.data.token, res.data.user);

      // Redirect based on role
      switch (res.data.user.role) {
        case 'Admin': navigate('/admin/dashboard'); break;
        case 'L1_Auditor': navigate('/l1/tasks'); break;
        case 'L2_Auditor': navigate('/l2/inbox'); break;
        case 'Process_Owner': navigate('/owner/tasks'); break;
        default: navigate('/');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="d-flex align-items-center justify-content-center min-vh-100" style={{ backgroundColor: '#f8fafc' }}>
      <Container style={{ maxWidth: '400px' }}>
        <Card className="shadow-lg border-0 rounded-3 overflow-hidden">
          <div style={{ height: '4px', backgroundColor: '#2563eb' }}></div>
          <Card.Body className="p-4 p-md-5">
            <div className="text-center mb-4">
              <img src="/DANA_logo.png" alt="DANA Logo" className="mb-2" style={{ height: '60px' }} />
              <div className="mb-3">
                <img src="/PeopleFindingABetterWay.png" alt="People Finding A Better Way" style={{ height: '25px' }} />
              </div>
              <h2 className="fw-bold text-dark mb-1">Audit Portal</h2>
              <p className="text-muted small">Please sign in to your corporate account</p>
            </div>

            {error && (
              <Alert variant="danger" className="py-2 text-center small">
                {error}
              </Alert>
            )}

            <Form onSubmit={handleSubmit}>
              <Form.Group className="mb-3">
                <Form.Label className="small fw-bold">Email Address</Form.Label>
                <Form.Control
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@dana.com"
                  required
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label className="small fw-bold">Password</Form.Label>
                <Form.Control
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter password"
                  required
                />
              </Form.Group>

              <Button
                variant="primary"
                type="submit"
                className="w-100 py-2 fw-bold"
                disabled={loading}
                style={{ backgroundColor: '#2563eb', border: 'none' }}
              >
                {loading ? <Spinner size="sm" animation="border" /> : 'Sign In'}
              </Button>
            </Form>
          </Card.Body>
        </Card>
        <div className="mt-4 text-center text-muted small">
          &copy; {new Date().getFullYear()} DANA Digital Auditing System
        </div>
      </Container>
    </div>
  );
};

export default Login;