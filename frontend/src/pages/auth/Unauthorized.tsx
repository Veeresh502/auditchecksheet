import { Container, Button } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';

const Unauthorized = () => {
  const navigate = useNavigate();
  return (
    <Container className="text-center mt-5">
      <h1 className="display-1 text-danger">403</h1>
      <h2>Access Denied</h2>
      <p>You do not have permission to view this page.</p>
      <Button onClick={() => navigate(-1)}>Go Back</Button>
    </Container>
  );
};
export default Unauthorized;