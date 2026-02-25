import { useState, useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Navbar, Container, Nav, Button, Offcanvas, Modal, Row, Col, Badge, Form, Spinner } from 'react-bootstrap';
import { useAuth } from '../../context/AuthContext';
import api from '../../api/axios';
import { FaClipboardList, FaTasks, FaExclamationTriangle, FaSignOutAlt, FaUserShield, FaHistory, FaUsers, FaShip, FaCalendarPlus, FaBars, FaIdCard, FaEnvelope, FaEdit, FaSave, FaTimes } from 'react-icons/fa';

const DashboardLayout = () => {
    const { user, logout, login } = useAuth(); // Assuming login can be used to update state
    const navigate = useNavigate();
    const location = useLocation();

    // State for responsiveness
    const [isMobile, setIsMobile] = useState(window.innerWidth < 992);

    // Separate states for mobile and desktop sidebars
    const [showMobileSidebar, setShowMobileSidebar] = useState(false);
    const [showDesktopSidebar, setShowDesktopSidebar] = useState(true);

    const [showUserModal, setShowUserModal] = useState(false);

    // User Edit State
    const [isEditing, setIsEditing] = useState(false);
    const [editName, setEditName] = useState('');
    const [updating, setUpdating] = useState(false);
    const [updateError, setUpdateError] = useState('');

    // Handle window resize to update isMobile state
    useEffect(() => {
        const handleResize = () => {
            const mobile = window.innerWidth < 992;
            setIsMobile(mobile);
            if (!mobile && !showDesktopSidebar) {
                // Optional: Auto-show on desktop switch
            }
        };

        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, [showDesktopSidebar]);

    // Reset edit state when modal opens
    useEffect(() => {
        if (showUserModal && user) {
            setEditName(user.full_name);
            setIsEditing(false);
            setUpdateError('');
        }
    }, [showUserModal, user]);

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        setUpdating(true);
        setUpdateError('');

        try {
            const res = await api.put('/auth/profile', { full_name: editName });

            // Update local user state
            // We reuse the login function to update the context state without relogging
            // Need to pass the current token if stored in localStorage
            const token = localStorage.getItem('token');
            if (token && res.data) {
                // Construct updated user object based on response or merge
                // The API returns { user_id, email, full_name, role }
                const updatedUser = res.data;
                login(token, updatedUser);
            }

            setIsEditing(false);
        } catch (err: any) {
            setUpdateError(err.response?.data?.error || 'Failed to update profile');
        } finally {
            setUpdating(false);
        }
    };

    const isActive = (path: string) => location.pathname.includes(path);

    const toggleSidebar = () => {
        if (isMobile) {
            setShowMobileSidebar(!showMobileSidebar);
        } else {
            setShowDesktopSidebar(!showDesktopSidebar);
        }
    };

    const closeMobileSidebar = () => setShowMobileSidebar(false);

    const SidebarContent = ({ isMobileView = false }) => (
        <div className="d-flex flex-column h-100">
            <div className="px-4 mb-3 mt-4">
                <small className="text-uppercase text-muted fw-bold tracking-widest" style={{ fontSize: '0.65rem' }}>Management</small>
            </div>

            <Nav className="flex-column px-2 gap-1 flex-grow-1">
                {/* L1 Links */}
                {user?.role === 'L1_Auditor' && (
                    <>
                        <Nav.Link
                            onClick={() => { navigate('/l1/tasks'); if (isMobileView) closeMobileSidebar(); }}
                            className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${isActive('/l1/tasks') && !location.search.includes('history') ? 'active' : ''}`}
                        >
                            <FaClipboardList /> <span>Active Tasks</span>
                        </Nav.Link>
                        <Nav.Link
                            onClick={() => { navigate('/l1/tasks?view=history'); if (isMobileView) closeMobileSidebar(); }}
                            className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${location.search.includes('view=history') ? 'active' : ''}`}
                        >
                            <FaHistory /> <span>Audit History</span>
                        </Nav.Link>
                    </>
                )}

                {/* L2 Links */}
                {user?.role === 'L2_Auditor' && (
                    <>
                        <Nav.Link
                            onClick={() => { navigate('/l2/inbox'); if (isMobileView) closeMobileSidebar(); }}
                            className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${isActive('/l2/inbox') && !location.search.includes('history') ? 'active' : ''}`}
                        >
                            <FaTasks /> <span>Review Inbox</span>
                        </Nav.Link>
                        <Nav.Link
                            onClick={() => { navigate('/l2/inbox?view=history'); if (isMobileView) closeMobileSidebar(); }}
                            className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${location.search.includes('view=history') ? 'active' : ''}`}
                        >
                            <FaHistory /> <span>Review History</span>
                        </Nav.Link>
                    </>
                )}

                {/* Owner Links */}
                {user?.role === 'Process_Owner' && (
                    <>
                        <Nav.Link
                            onClick={() => { navigate('/owner/tasks'); if (isMobileView) closeMobileSidebar(); }}
                            className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${isActive('/owner/tasks') && !location.search.includes('history') ? 'active' : ''}`}
                        >
                            <FaExclamationTriangle /> <span>Action Required</span>
                        </Nav.Link>
                        <Nav.Link
                            onClick={() => { navigate('/owner/tasks?view=history'); if (isMobileView) closeMobileSidebar(); }}
                            className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${location.search.includes('view=history') ? 'active' : ''}`}
                        >
                            <FaHistory /> <span>NC History</span>
                        </Nav.Link>
                    </>
                )}

                {/* Admin Links */}
                {user?.role === 'Admin' && (
                    <>
                        <Nav.Link onClick={() => { navigate('/admin/dashboard'); if (isMobileView) closeMobileSidebar(); }} className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${isActive('/admin/dashboard') ? 'active' : ''}`}>
                            <FaUserShield /> <span>Dashboard</span>
                        </Nav.Link>
                        <Nav.Link onClick={() => { navigate('/admin/schedule'); if (isMobileView) closeMobileSidebar(); }} className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${isActive('/admin/schedule') ? 'active' : ''}`}>
                            <FaCalendarPlus /> <span>Schedule Audit</span>
                        </Nav.Link>
                        <Nav.Link onClick={() => { navigate('/admin/users'); if (isMobileView) closeMobileSidebar(); }} className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${isActive('/admin/users') ? 'active' : ''}`}>
                            <FaUsers /> <span>User Management</span>
                        </Nav.Link>
                        <Nav.Link onClick={() => { navigate('/admin/dock-plan'); if (isMobileView) closeMobileSidebar(); }} className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${isActive('/admin/dock-plan') ? 'active' : ''}`}>
                            <FaShip /> <span>Dock Audit Plan</span>
                        </Nav.Link>
                        <Nav.Link onClick={() => { navigate('/admin/mfg-plan'); if (isMobileView) closeMobileSidebar(); }} className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${isActive('/admin/mfg-plan') ? 'active' : ''}`}>
                            <FaClipboardList /> <span>Manufacturing Plan</span>
                        </Nav.Link>
                        <Nav.Link onClick={() => { navigate('/admin/analytics'); if (isMobileView) closeMobileSidebar(); }} className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${isActive('/admin/analytics') ? 'active' : ''}`}>
                            <FaClipboardList /> <span>Audit Analytics</span>
                        </Nav.Link>
                        <Nav.Link onClick={() => { navigate('/admin/templates'); if (isMobileView) closeMobileSidebar(); }} className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${isActive('/admin/templates') ? 'active' : ''}`}>
                            <FaTasks /> <span>Template Manager</span>
                        </Nav.Link>
                        <Nav.Link onClick={() => { navigate('/admin/nc-history'); if (isMobileView) closeMobileSidebar(); }} className={`d-flex align-items-center gap-3 rounded-3 px-3 py-2 ${isActive('/admin/nc-history') ? 'active' : ''}`}>
                            <FaHistory /> <span>NC History</span>
                        </Nav.Link>
                    </>
                )}
            </Nav>

            <div
                className="p-3 border-top mt-auto user-profile-nav"
                onClick={() => {
                    setShowUserModal(true);
                    if (isMobileView) closeMobileSidebar();
                }}
            >
                <div className="d-flex align-items-center gap-3 px-2 py-1">
                    <div className="bg-primary bg-opacity-10 text-primary p-2 rounded-circle border border-primary border-opacity-25 shadow-sm fw-bold d-flex align-items-center justify-content-center" style={{ width: '40px', height: '40px' }}>
                        {user?.full_name.charAt(0)}
                    </div>
                    <div className="overflow-hidden">
                        <div className="fw-bold text-dark text-truncate small">{user?.full_name}</div>
                        <div className="text-muted x-small text-truncate text-uppercase tracking-wider">{user?.role.replace('_', ' ')}</div>
                    </div>
                </div>
            </div>
        </div >
    );

    return (
        <div className="d-flex flex-column min-vh-100 bg-light">
            {/* Top Navbar */}
            <Navbar bg="white" variant="light" className="shadow-sm sticky-top border-bottom py-0" style={{ height: '65px', zIndex: 1020 }}>
                <Container fluid className="px-3 px-md-4 h-100">
                    <div className="d-flex align-items-center gap-2 gap-md-3 w-100 h-100">
                        {/* Sidebar Hide/Unhide Button */}
                        <Button
                            variant="light"
                            className="p-2 border shadow-sm d-flex align-items-center justify-content-center"
                            onClick={toggleSidebar}
                            style={{ width: '40px', height: '40px', minWidth: '40px' }}
                            title="Toggle Sidebar"
                        >
                            <FaBars className="fs-5" />
                        </Button>

                        {/* Header Content: Text -> DANA -> People */}
                        <div className="d-flex align-items-center gap-2 gap-md-3 flex-grow-1 overflow-hidden">
                            {/* 1. Audit Portal Text (Far Left) */}
                            <div className="d-flex flex-column d-mobile-none">
                                <span className="fw-bold text-primary fs-6 fs-md-5 lh-1 text-nowrap">Audit Portal</span>
                                <span className="text-muted d-none d-md-block" style={{ fontSize: '0.65rem' }}>Audit Management System</span>
                            </div>

                            {/* Divider */}
                            <div className="vr d-none d-md-block text-muted mx-1" style={{ height: '24px' }}></div>

                            {/* 2. DANA Logo */}
                            <img src="/DANA_logo.png" alt="DANA Logo" height="28" className="d-block flex-shrink-0" style={{ objectFit: 'contain', maxWidth: '80px' }} />

                            {/* 3. People Logo (Smaller) */}
                            <img src="/PeopleFindingABetterWay.png" alt="People Finding A Better Way" height="16" className="d-none d-sm-block flex-shrink-0" style={{ objectFit: 'contain', maxWidth: '150px' }} />
                        </div>



                        {/* Right Side Actions */}
                        <div className="ms-auto d-flex align-items-center gap-3">
                            <Button
                                variant="outline-danger"
                                size="sm"
                                className="d-flex align-items-center gap-2"
                                onClick={handleLogout}
                            >
                                <FaSignOutAlt /> <span className="d-none d-md-inline">Sign Out</span>
                            </Button>
                        </div>
                    </div>
                </Container>
            </Navbar>

            {/* Sidebar & Main Content */}
            <div className="d-flex flex-grow-1 position-relative">
                {/* Desktop Sidebar (Fixed) */}
                <div
                    className={`d-none d-lg-block bg-white shadow-sm border-end`}
                    style={{
                        position: 'fixed',
                        top: '65px', // Matches Approx Header Height
                        bottom: 0,
                        left: 0,
                        width: showDesktopSidebar ? '300px' : '0px',
                        overflowY: 'auto',
                        transition: 'width 0.3s ease-in-out',
                        overflowX: 'hidden',
                        zIndex: 1000
                    }}
                >
                    <div style={{ width: '300px' }} className="h-100">
                        <SidebarContent />
                    </div>
                </div>

                {/* Mobile Sidebar (Offcanvas) */}
                <Offcanvas show={showMobileSidebar} onHide={closeMobileSidebar} placement="start" className="d-lg-none" style={{ width: '300px' }}>
                    <Offcanvas.Header closeButton>
                        <Offcanvas.Title className="fw-bold">Menu</Offcanvas.Title>
                    </Offcanvas.Header>
                    <Offcanvas.Body className="p-0">
                        <SidebarContent isMobileView={true} />
                    </Offcanvas.Body>
                </Offcanvas>

                {/* Main Content Area - Scrollable */}
                <div
                    className="flex-grow-1 p-2 p-md-4"
                    style={{
                        marginLeft: !isMobile && showDesktopSidebar ? '300px' : '0',
                        transition: 'margin-left 0.3s ease-in-out',
                        width: !isMobile && showDesktopSidebar ? 'calc(100% - 300px)' : '100%',
                        minHeight: 'calc(100vh - 65px)',
                        background: '#f8fafc',
                        overflowX: 'hidden'
                    }}
                >
                    <Container fluid className="px-1 px-md-3">
                        <Outlet />
                    </Container>
                </div>
            </div>

            {/* User Details Modal */}
            <Modal show={showUserModal} onHide={() => { setShowUserModal(false); setIsEditing(false); }} centered>
                <Modal.Header closeButton className="border-0 pb-0">
                    <Modal.Title className="fw-bold text-primary">
                        {isEditing ? 'Edit Profile' : 'User Profile'}
                    </Modal.Title>
                </Modal.Header>
                <Modal.Body className="pt-2 pb-4">
                    <div className="text-center mb-4">
                        <div className="bg-primary bg-opacity-10 p-3 rounded-circle d-inline-block mb-3">
                            <FaUserShield className="text-primary display-4" />
                        </div>

                        {!isEditing ? (
                            <>
                                <h4 className="fw-bold">{user?.full_name}</h4>
                                <Badge bg="info" className="text-dark px-3 py-2 rounded-pill">
                                    {user?.role.replace('_', ' ')}
                                </Badge>
                            </>
                        ) : (
                            <div className="d-flex justify-content-center">
                                <span className="text-muted small">Editing Information</span>
                            </div>
                        )}
                    </div>

                    <div className="bg-light p-3 rounded-3 mb-4">
                        {!isEditing ? (
                            <Row className="g-3">
                                <Col xs={12}>
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="bg-white p-2 rounded shadow-sm text-secondary">
                                            <FaEnvelope />
                                        </div>
                                        <div>
                                            <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>Email Address</small>
                                            <span className="fw-medium">{user?.email}</span>
                                        </div>
                                    </div>
                                </Col>
                                <Col xs={12}>
                                    <div className="d-flex align-items-center gap-3">
                                        <div className="bg-white p-2 rounded shadow-sm text-secondary">
                                            <FaIdCard />
                                        </div>
                                        <div>
                                            <small className="text-muted d-block" style={{ fontSize: '0.7rem' }}>User ID</small>
                                            <span className="fw-medium text-break">{user?.user_id}</span>
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        ) : (
                            <Form onSubmit={handleUpdateProfile}>
                                {updateError && <div className="text-danger small mb-2">{updateError}</div>}
                                <Form.Group className="mb-3" controlId="formFullName">
                                    <Form.Label className="small fw-bold">Full Name</Form.Label>
                                    <Form.Control
                                        type="text"
                                        value={editName}
                                        onChange={(e) => setEditName(e.target.value)}
                                        required
                                        autoFocus
                                    />
                                </Form.Group>

                                <div className="d-flex gap-2">
                                    <Button variant="primary" type="submit" size="sm" className="w-50" disabled={updating}>
                                        {updating ? <Spinner size="sm" animation="border" /> : <><FaSave className="me-1" /> Save</>}
                                    </Button>
                                    <Button variant="secondary" size="sm" className="w-50" onClick={() => setIsEditing(false)} disabled={updating}>
                                        <FaTimes className="me-1" /> Cancel
                                    </Button>
                                </div>
                            </Form>
                        )}
                    </div>

                    {!isEditing && (
                        <Row className="g-2">
                            <Col xs={6}>
                                <Button variant="outline-primary" className="w-100 d-flex align-items-center justify-content-center gap-2" onClick={() => setIsEditing(true)}>
                                    <FaEdit /> Edit Name
                                </Button>
                            </Col>
                            <Col xs={6}>
                                <Button variant="outline-danger" className="w-100 d-flex align-items-center justify-content-center gap-2" onClick={handleLogout}>
                                    <FaSignOutAlt /> Sign Out
                                </Button>
                            </Col>
                        </Row>
                    )}
                </Modal.Body>
            </Modal>
        </div >
    );
};

export default DashboardLayout;
