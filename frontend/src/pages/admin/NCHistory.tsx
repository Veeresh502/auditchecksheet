import { useState, useEffect } from 'react';
import { Container, Table, Badge, Form, InputGroup, Card } from 'react-bootstrap';
import api from '../../api/axios';
import Skeleton from '../../components/common/Skeleton';
import { FaSearch, FaHistory, FaExclamationCircle, FaCheckCircle, FaFileAlt } from 'react-icons/fa';

const AdminNCHistory = () => {
    const [ncs, setNcs] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('All');

    useEffect(() => {
        fetchNCs();
    }, []);

    const fetchNCs = async () => {
        try {
            const res = await api.get('/nc/admin/all');
            setNcs(res.data);
        } catch (err) {
            console.error("Failed to fetch NC history", err);
        } finally {
            setLoading(false);
        }
    };

    const filteredNCs = ncs.filter(nc => {
        const matchesSearch =
            nc.machine_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            nc.issue_description?.toLowerCase().includes(searchTerm.toLowerCase());

        const matchesStatus = statusFilter === 'All' || nc.status === statusFilter;

        return matchesSearch && matchesStatus;
    });

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'Open': return <Badge bg="danger"><FaExclamationCircle className="me-1" /> Open</Badge>;
            case 'Pending_Verification': return <Badge bg="warning" text="dark"><FaHistory className="me-1" /> Pending</Badge>;
            case 'Closed': return <Badge bg="success"><FaCheckCircle className="me-1" /> Closed</Badge>;
            default: return <Badge bg="secondary">{status}</Badge>;
        }
    };

    if (loading) {
        return (
            <Container fluid className="py-4">
                <Skeleton height={50} className="mb-4" />
                <Skeleton height={400} />
            </Container>
        );
    }

    return (
        <Container fluid className="py-4 fade-in">
            <div className="d-flex justify-content-between align-items-center mb-4">
                <div>
                    <h4 className="fw-bold mb-1">NC History Log</h4>
                    <p className="text-muted small mb-0">Centralized tracking of all audit non-conformances</p>
                </div>
            </div>

            <Card className="border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                <Card.Body className="bg-light bg-opacity-50 p-3">
                    <div className="d-flex flex-column flex-md-row gap-3">
                        <InputGroup className="flex-grow-1 shadow-sm rounded-3 overflow-hidden">
                            <InputGroup.Text className="bg-white border-end-0">
                                <FaSearch className="text-muted" />
                            </InputGroup.Text>
                            <Form.Control
                                placeholder="Search by Machine or Description..."
                                className="border-start-0 py-2"
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                            />
                        </InputGroup>
                        <Form.Select
                            className="w-auto shadow-sm rounded-3 py-2"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value)}
                        >
                            <option value="All">All Statuses</option>
                            <option value="Open">Open</option>
                            <option value="Pending_Verification">Pending Verification</option>
                            <option value="Closed">Closed</option>
                        </Form.Select>
                    </div>
                </Card.Body>
            </Card>

            <Card className="border-0 shadow-sm rounded-4 overflow-hidden">
                <div className="table-responsive">
                    <Table hover className="align-middle mb-0">
                        <thead className="bg-light border-bottom">
                            <tr>
                                <th className="ps-4 py-3 x-small text-muted text-uppercase tracking-widest">Date / ID</th>
                                <th className="py-3 x-small text-muted text-uppercase tracking-widest">Audit Context</th>
                                <th className="py-3 x-small text-muted text-uppercase tracking-widest">Issue Description</th>
                                <th className="py-3 x-small text-muted text-uppercase tracking-widest">Auditor / Owner</th>
                                <th className="py-3 x-small text-muted text-uppercase tracking-widest text-center">Status</th>
                                <th className="py-3 pe-4 x-small text-muted text-uppercase tracking-widest text-center">Evidence</th>
                            </tr>
                        </thead>
                        <tbody>
                            {filteredNCs.length > 0 ? filteredNCs.map((nc) => (
                                <tr key={nc.nc_id} className="border-bottom-light">
                                    <td className="ps-4">
                                        <div className="fw-bold text-dark mb-1" style={{ fontSize: '0.9rem' }}>
                                            {new Date(nc.created_at).toLocaleDateString()}
                                        </div>
                                        <div className="text-muted x-small">ID: {nc.nc_id.split('-')[0]}...</div>
                                    </td>
                                    <td>
                                        <div className="fw-bold text-primary mb-1" style={{ fontSize: '0.9rem' }}>{nc.machine_name}</div>
                                        <div className="text-muted x-small">{nc.shift} Shift | {new Date(nc.audit_date).toLocaleDateString()}</div>
                                    </td>
                                    <td>
                                        <div className="text-dark mb-1" style={{ fontSize: '0.85rem', maxWidth: '300px' }}>
                                            {nc.issue_description}
                                        </div>
                                        {nc.question_text && <div className="text-muted x-small italic text-truncate" style={{ maxWidth: '250px' }}>Q: {nc.question_text}</div>}
                                    </td>
                                    <td>
                                        <div className="d-flex flex-column">
                                            <span className="small mb-1">Auditor: <span className="fw-semibold">{nc.auditor_name}</span></span>
                                            <span className="small">Owner: <span className="fw-semibold">{nc.owner_name}</span></span>
                                        </div>
                                    </td>
                                    <td className="text-center">
                                        {getStatusBadge(nc.status)}
                                    </td>
                                    <td className="pe-4 text-center">
                                        {nc.issue_image_url ? (
                                            <a href={nc.issue_image_url} target="_blank" rel="noopener noreferrer" className="btn btn-sm btn-outline-primary rounded-pill px-3">
                                                <FaFileAlt className="me-1" /> View
                                            </a>
                                        ) : (
                                            <span className="text-muted x-small">No Evidence</span>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan={6} className="text-center py-5 text-muted">
                                        No Non-Conformances found matching your criteria.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </Table>
                </div>
            </Card>
        </Container>
    );
};

export default AdminNCHistory;
