import { Navbar, Container, Button, Badge } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext.tsx';
import { useNavigate } from 'react-router-dom';

const AppNavbar = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <Navbar expand="lg" className="mb-4 shadow-sm" style={{ backgroundColor: '#2563eb' }} variant="dark">
      <Container>
        <Navbar.Brand className="fw-bold cursor-pointer" onClick={() => navigate('/')}>
          DANA Digital Audit
        </Navbar.Brand>

        <div className="d-flex align-items-center gap-3">
          {user && (
            <>
              <div className="text-white text-end">
                <div className="fw-bold small">{user.full_name}</div>
                <Badge bg="light" className="text-primary" style={{ fontSize: '10px' }}>{user.role.replace(/_/g, ' ')}</Badge>
              </div>
              <Button variant="outline-light" size="sm" onClick={handleLogout}>
                Logout
              </Button>
            </>
          )}
        </div>
      </Container>
    </Navbar>
  );
};

export default AppNavbar;