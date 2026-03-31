import { useState, useEffect } from 'react';
import { Container, Table, Button, Modal, Form, Badge, Spinner } from 'react-bootstrap';
import { FaTrash, FaUserPlus, FaEdit } from 'react-icons/fa';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import ConfirmationModal from '../../components/common/ConfirmationModal';

const UserManagement = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [userToDelete, setUserToDelete] = useState<string | null>(null);

  // New User Form State
  const [formData, setFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: 'L1_Auditor' // Default
  });

  // Edit User Form State
  const [showEditModal, setShowEditModal] = useState(false);
  const [editUserId, setEditUserId] = useState<string | null>(null);
  const [editFormData, setEditFormData] = useState({
    full_name: '',
    email: '',
    password: '',
    role: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const res = await api.get('/users');
      setUsers(res.data);
    } catch (err) {
      toast.error("Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.post('/users', formData);
      toast.success("User Created Successfully!");
      setShowModal(false);
      setFormData({ full_name: '', email: '', password: '', role: 'L1_Auditor' }); // Reset
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to create user");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    try {
      await api.delete(`/users/${userId}`);
      toast.success("User deleted successfully");
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete user");
    }
  };

  const handleEditClick = (u: any) => {
    setEditUserId(u.user_id);
    setEditFormData({
      full_name: u.full_name,
      email: u.email,
      role: u.role,
      password: '' // Don't fetch current password, naturally
    });
    setShowEditModal(true);
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.put(`/users/${editUserId}`, editFormData);
      toast.success("User updated successfully!");
      setShowEditModal(false);
      fetchUsers();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to update user");
    }
  };

  const getRoleBadge = (role: string) => {
    switch (role) {
      case 'Admin': return <Badge bg="dark">Admin</Badge>;
      case 'L1_Auditor': return <Badge bg="primary">L1 Auditor</Badge>;
      case 'L2_Auditor': return <Badge bg="warning" text="dark">L2 Auditor</Badge>;
      case 'Process_Owner': return <Badge bg="info">Process Owner</Badge>;
      default: return <Badge bg="secondary">{role}</Badge>;
    }
  };

  if (loading) return <div className="text-center mt-5"><Spinner animation="border" /></div>;

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h3 className="fw-bold m-0">User Management</h3>
        <Button variant="primary" className="shadow-sm px-4" onClick={() => setShowModal(true)}>
          <FaUserPlus className="me-2" /> Add New User
        </Button>
      </div>

      <Table hover responsive className="align-middle shadow-sm">
        <thead className="table-light">
          <tr>
            <th>Name</th>
            <th>Email</th>
            <th>Role</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {users.map((u: any) => (
            <tr key={u.user_id}>
              <td className="fw-bold">{u.full_name}</td>
              <td>{u.email}</td>
              <td>{getRoleBadge(u.role)}</td>
              <td>
                <Button variant="outline-primary" size="sm" className="me-2" onClick={() => handleEditClick(u)} title="Edit User">
                  <FaEdit />
                </Button>
                {u.role !== 'Admin' && (
                  <Button variant="outline-danger" size="sm" onClick={() => setUserToDelete(u.user_id)} title="Delete User">
                    <FaTrash />
                  </Button>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </Table>

      {/* Create User Modal */}
      <Modal show={showModal} onHide={() => setShowModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Add System User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleCreateUser}>
            <Form.Group className="mb-3">
              <Form.Label>Full Name</Form.Label>
              <Form.Control
                required
                value={formData.full_name}
                onChange={e => setFormData({ ...formData, full_name: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                required
                value={formData.email}
                onChange={e => setFormData({ ...formData, email: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Password</Form.Label>
              <Form.Control
                type="password"
                required
                value={formData.password}
                onChange={e => setFormData({ ...formData, password: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select
                value={formData.role}
                onChange={e => setFormData({ ...formData, role: e.target.value })}
              >
                <option value="L1_Auditor">L1 Auditor (Inspector)</option>
                <option value="L2_Auditor">L2 Auditor (Approver)</option>
                <option value="Process_Owner">Process Owner (Fixer)</option>
                <option value="Admin">Administrator</option>
              </Form.Select>
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={() => setShowModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Create User</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      {/* Edit User Modal */}
      <Modal show={showEditModal} onHide={() => setShowEditModal(false)}>
        <Modal.Header closeButton>
          <Modal.Title>Edit User</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <Form onSubmit={handleUpdateUser}>
            <Form.Group className="mb-3">
              <Form.Label>Full Name</Form.Label>
              <Form.Control
                required
                value={editFormData.full_name}
                onChange={e => setEditFormData({ ...editFormData, full_name: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Email</Form.Label>
              <Form.Control
                type="email"
                required
                value={editFormData.email}
                onChange={e => setEditFormData({ ...editFormData, email: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>New Password <small className="text-muted">(Leave dummy text or empty to keep current password)</small></Form.Label>
              <Form.Control
                type="password"
                placeholder="Enter new password"
                value={editFormData.password}
                onChange={e => setEditFormData({ ...editFormData, password: e.target.value })}
              />
            </Form.Group>
            <Form.Group className="mb-3">
              <Form.Label>Role</Form.Label>
              <Form.Select
                value={editFormData.role}
                onChange={e => setEditFormData({ ...editFormData, role: e.target.value })}
              >
                <option value="L1_Auditor">L1 Auditor (Inspector)</option>
                <option value="L2_Auditor">L2 Auditor (Approver)</option>
                <option value="Process_Owner">Process Owner (Fixer)</option>
                <option value="Admin">Administrator</option>
              </Form.Select>
            </Form.Group>
            <div className="d-flex justify-content-end gap-2">
              <Button variant="secondary" onClick={() => setShowEditModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary">Save Changes</Button>
            </div>
          </Form>
        </Modal.Body>
      </Modal>

      <ConfirmationModal
        show={!!userToDelete}
        onClose={() => setUserToDelete(null)}
        onConfirm={() => {
          if (userToDelete) handleDeleteUser(userToDelete);
          setUserToDelete(null);
        }}
        title="Delete User"
        message="Are you sure? This user will be permanently deleted."
        confirmText="Delete"
        variant="danger"
      />
    </Container>
  );
};

export default UserManagement;