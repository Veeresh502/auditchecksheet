import { useState, useEffect } from 'react';
import { Container, Row, Col, Card, Button } from 'react-bootstrap';
import { FaCalendarAlt, FaCheckCircle, FaExclamationTriangle, FaTimesCircle } from 'react-icons/fa';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell
} from 'recharts';

const DockAnalytics = () => {
    const navigate = useNavigate();
    const [stats, setStats] = useState<any>({
        scheduled: 0,
        completed: 0,
        nc_total: 0,
        rejected: 0,
        monthly_trend: [],
        nc_breakdown: []
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        fetchStats();
    }, []);

    const fetchStats = async () => {
        try {
            const res = await api.get('/analytics/dock-sub');
            setStats(res.data);
        } catch (error) {
            console.error(error);
            toast.error("Failed to load analytics");
        } finally {
            setLoading(false);
        }
    };

    if (loading) return (
        <div className="d-flex justify-content-center align-items-center" style={{ height: '80vh' }}>
            <div className="text-center">
                <div className="spinner-grow text-primary mb-3" role="status"></div>
                <p className="text-muted fw-bold">Gathering Intelligence...</p>
            </div>
        </div>
    );

    const statCards = [
        {
            title: 'Scheduled',
            value: stats.scheduled,
            icon: <FaCalendarAlt size={20} />,
            gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            description: 'In progress'
        },
        {
            title: 'Completed',
            value: stats.completed,
            icon: <FaCheckCircle size={20} />,
            gradient: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            description: 'Closed audits'
        },
        {
            title: 'NCs Raised',
            value: stats.nc_total,
            icon: <FaExclamationTriangle size={20} />,
            gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            description: 'Non-conformances'
        },
        {
            title: 'Rejected',
            value: stats.rejected,
            icon: <FaTimesCircle size={20} />,
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            description: 'Failed L2 review'
        }
    ];

    const statusData = [
        { name: 'Scheduled', value: stats.scheduled || 0 },
        { name: 'Completed', value: stats.completed || 0 },
        { name: 'Rejected', value: stats.rejected || 0 }
    ];
    const COLORS = ['#4facfe', '#43e97b', '#f5576c'];

    const ncData = stats.nc_breakdown.map((item: any) => ({
        name: item.status,
        value: parseInt(item.count)
    }));
    const NC_COLORS = ['#fa709a', '#fee140', '#4facfe', '#43e97b'];

    const CustomTooltip = ({ active, payload, label }: any) => {
        if (active && payload && payload.length) {
            return (
                <div className="bg-white p-2 border-0 shadow-sm rounded" style={{ borderLeft: `4px solid ${payload[0].fill}` }}>
                    <p className="mb-0 small fw-bold text-dark">{`${label || payload[0].name}: ${payload[0].value}`}</p>
                </div>
            );
        }
        return null;
    };

    return (
        <Container fluid className="py-4" style={{ backgroundColor: '#fcfdfe', minHeight: '100vh' }}>
            <div className="mb-4">
                <Button variant="link" className="text-decoration-none text-muted p-0 mb-3" onClick={() => navigate('/admin/dashboard')}>
                    ← Back to Dashboard
                </Button>
                <div className="d-flex justify-content-between align-items-end">
                    <div>
                        <h2 className="fw-bold text-dark mb-1">Audit Summary Dashboard</h2>
                        <p className="text-muted mb-0 small uppercase tracking-wider">Visual analytics & performance KPIs</p>
                    </div>
                </div>
            </div>

            <Row className="mb-4">
                {statCards.map((card, index) => (
                    <Col key={index} xl={3} lg={6} className="mb-3">
                        <Card className="h-100 border-0 shadow-sm" style={{ borderRadius: '12px', overflow: 'hidden' }}>
                            <div style={{ height: '4px', background: card.gradient }}></div>
                            <Card.Body className="p-4">
                                <div className="d-flex justify-content-between align-items-start mb-3">
                                    <div className="p-2 rounded-3" style={{ background: `${card.gradient}20`, color: '#333' }}>
                                        {card.icon}
                                    </div>
                                    <div className="text-end">
                                        <h6 className="text-uppercase text-muted fw-bold mb-1" style={{ fontSize: '11px', letterSpacing: '0.5px' }}>{card.title}</h6>
                                        <h3 className="fw-bold mb-0">{card.value}</h3>
                                    </div>
                                </div>
                                <p className="small text-muted mb-0 opacity-75">{card.description}</p>
                            </Card.Body>
                        </Card>
                    </Col>
                ))}
            </Row>

            <Row>
                <Col lg={8} className="mb-4">
                    <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '16px' }}>
                        <Card.Header className="bg-white py-4 border-0">
                            <h6 className="mb-0 fw-bold text-indigo">Monthly Completion Trend</h6>
                        </Card.Header>
                        <Card.Body className="p-4" style={{ minHeight: '400px' }}>
                            <ResponsiveContainer width="100%" height="100%">
                                <BarChart data={stats.monthly_trend}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                                    <XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: '#999', fontSize: 12 }} />
                                    <YAxis allowDecimals={false} axisLine={false} tickLine={false} tick={{ fill: '#999', fontSize: 12 }} />
                                    <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f8f9fa' }} />
                                    <Bar dataKey="count" fill="#4facfe" radius={[4, 4, 0, 0]} barSize={32} />
                                </BarChart>
                            </ResponsiveContainer>
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={4} className="mb-4">
                    <Card className="border-0 shadow-sm h-100" style={{ borderRadius: '16px' }}>
                        <Card.Header className="bg-white py-4 border-0">
                            <h6 className="mb-0 fw-bold text-indigo">Audit Status Distribution</h6>
                        </Card.Header>
                        <Card.Body className="p-0 d-flex flex-column align-items-center justify-content-center" style={{ minHeight: '350px' }}>
                            <ResponsiveContainer width="100%" height={260}>
                                <PieChart>
                                    <Pie
                                        data={statusData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={90}
                                        paddingAngle={5}
                                        dataKey="value"
                                        stroke="none"
                                    >
                                        {statusData.map((_item: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip content={<CustomTooltip />} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="w-100 px-4 mb-4">
                                {statusData.map((item, idx) => (
                                    <div key={idx} className="d-flex justify-content-between align-items-center mb-2">
                                        <div className="d-flex align-items-center gap-2">
                                            <div style={{ width: '10px', height: '10px', borderRadius: '50%', backgroundColor: COLORS[idx] }}></div>
                                            <span className="small text-muted fw-bold">{item.name}</span>
                                        </div>
                                        <span className="small fw-bold">{item.value}</span>
                                    </div>
                                ))}
                            </div>
                        </Card.Body>
                    </Card>
                </Col>

                <Col lg={12} className="mb-4">
                    <Card className="border-0 shadow-sm" style={{ borderRadius: '16px' }}>
                        <Card.Header className="bg-white py-4 border-0">
                            <h6 className="mb-0 fw-bold text-indigo">Non-Conformance (NC) Summary</h6>
                        </Card.Header>
                        <Card.Body className="p-4">
                            <Row className="align-items-center">
                                <Col md={6}>
                                    <div style={{ height: '250px' }}>
                                        <ResponsiveContainer width="100%" height="100%">
                                            <PieChart>
                                                <Pie
                                                    data={ncData}
                                                    cx="50%"
                                                    cy="50%"
                                                    outerRadius={80}
                                                    dataKey="value"
                                                    label={({ name, percent }: any) => `${name} ${(percent * 100).toFixed(0)}%`}
                                                    stroke="none"
                                                >
                                                    {ncData.map((_item: any, index: number) => (
                                                        <Cell key={`cell-${index}`} fill={NC_COLORS[index % NC_COLORS.length]} />
                                                    ))}
                                                </Pie>
                                                <Tooltip content={<CustomTooltip />} />
                                            </PieChart>
                                        </ResponsiveContainer>
                                    </div>
                                </Col>
                                <Col md={6}>
                                    <div className="ps-md-4">
                                        <h5 className="fw-bold mb-3">Resolution Quality</h5>
                                        <p className="small text-muted mb-4">Real-time status of corrective actions. Efficient NC closure reduces overall operational risk.</p>
                                        <div className="d-flex flex-wrap gap-3">
                                            {ncData.map((nc: any, idx: number) => (
                                                <div key={idx} className="bg-light p-3 rounded-3 border" style={{ minWidth: '140px' }}>
                                                    <div className="d-flex align-items-center gap-2 mb-1">
                                                        <div style={{ width: '8px', height: '8px', borderRadius: '50%', backgroundColor: NC_COLORS[idx] }}></div>
                                                        <small className="text-muted text-uppercase fw-bold" style={{ fontSize: '10px' }}>{nc.name}</small>
                                                    </div>
                                                    <div className="h4 fw-bold mb-0">{nc.value}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </Col>
                            </Row>
                        </Card.Body>
                    </Card>
                </Col>
            </Row>
        </Container>
    );
};

export default DockAnalytics;
