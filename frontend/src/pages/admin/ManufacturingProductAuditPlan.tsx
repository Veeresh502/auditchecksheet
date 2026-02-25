import React, { useEffect, useState } from 'react';
import { Container, Table, Badge, Form, Modal, Button, Card } from 'react-bootstrap';
import { mfgApi } from '../../api/mfg';
import api from '../../api/axios';
import { useAuth } from '../../context/AuthContext.tsx';
import Skeleton from '../../components/common/Skeleton';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { FaEdit, FaPlus, FaTrash, FaDownload, FaTimes } from 'react-icons/fa';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const ManufacturingProductAuditPlan = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [actuals, setActuals] = useState<any[]>([]);
    const [plans, setPlans] = useState<any[]>([]);
    const [products, setProducts] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [year, setYear] = useState(2026);
    const [quarter, setQuarter] = useState<string>('All');
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    useEffect(() => {
        const handleResize = () => setWindowWidth(window.innerWidth);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    const isMobile = windowWidth < 768;
    const stickyWidth = isMobile ? '130px' : '220px';
    const scopeWidth = isMobile ? '50px' : '80px';
    const scopeLeft = isMobile ? '130px' : '220px';

    // UI State for Modals
    const [showAddModal, setShowAddModal] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [deleteProductConfirm, setDeleteProductConfirm] = useState<string | null>(null);
    const [deleteAuditConfirm, setDeleteAuditConfirm] = useState<string | null>(null);

    // Rescheduling & Manual Scheduling State
    const [editDateAudit, setEditDateAudit] = useState<any | null>(null);
    const [newDate, setNewDate] = useState<string>('');
    const [scheduleConfirm, setScheduleConfirm] = useState<{ product: string, month: string, week: number } | null>(null);

    // Filter months based on quarter
    const filteredMonths = quarter === 'All'
        ? months
        : months.slice((parseInt(quarter) - 1) * 3, parseInt(quarter) * 3);

    useEffect(() => {
        fetchData();
    }, [year]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [data, prodList] = await Promise.all([
                mfgApi.getPlan(year),
                mfgApi.getProducts()
            ]);
            setActuals(data.actuals);
            setPlans(data.plan);
            setProducts(prodList);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load manufacturing audit plan");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAudit = async () => {
        if (!deleteAuditConfirm) return;
        try {
            await api.delete(`/audits/${deleteAuditConfirm}`);
            toast.success('Audit deleted successfully');
            setDeleteAuditConfirm(null);
            fetchData();
        } catch (err) {
            toast.error('Failed to delete audit');
        }
    };

    const handleUpdateDate = async () => {
        if (!editDateAudit || !newDate) return;
        try {
            await api.patch(`/audits/${editDateAudit.audit_id}/dates`, { audit_date: newDate });
            toast.success('Audit rescheduled successfully!');
            fetchData();
            setEditDateAudit(null);
        } catch (err) {
            toast.error('Failed to update audit date');
        }
    };

    const handleSchedule = async () => {
        if (!scheduleConfirm) return;
        const { product, month, week } = scheduleConfirm;
        try {
            const tRes = await api.get('/templates');
            const template = tRes.data.find((t: any) => t.template_name.toLowerCase().includes('manufacturing'));
            if (!template) {
                toast.error('Manufacturing Template not found');
                return;
            }
            const monthIdx = months.indexOf(month);
            const day = (week - 1) * 7 + 5;
            const audit_date = new Date(year, monthIdx, day).toISOString().split('T')[0];
            const l1Res = await api.get('/users?role=L1_Auditor');
            const l2Res = await api.get('/users?role=L2_Auditor');
            const poRes = await api.get('/users?role=Process_Owner');
            const newAuditRes = await api.post('/audits/schedule', {
                template_id: template.template_id,
                machine_name: product,
                audit_date: audit_date,
                shift: 'A',
                l1_auditor_id: l1Res.data?.[0]?.user_id || user?.user_id,
                l2_auditor_id: l2Res.data?.[0]?.user_id || user?.user_id,
                process_owner_id: poRes.data?.[0]?.user_id || user?.user_id,
                operation: 'Scheduled Manually',
                part_name: product,
                part_number: 'REF-PLAN',
                process: product,
            });
            toast.success('Manual Audit Scheduled!');
            fetchData();
            navigate(`/l1/audit/${newAuditRes.data.audit_id}`);
        } catch (err) {
            toast.error('Failed to schedule audit');
        } finally {
            setScheduleConfirm(null);
        }
    };

    const handleAddProduct = async () => {
        if (!newProductName.trim()) return;
        try {
            await mfgApi.addProduct(newProductName.trim());
            toast.success('Product added successfully');
            setNewProductName('');
            setShowAddModal(false);
            fetchData();
        } catch (err) {
            toast.error('Failed to add product');
        }
    };

    const handleDeleteProduct = async () => {
        if (!deleteProductConfirm) return;
        try {
            await mfgApi.deleteProduct(deleteProductConfirm);
            toast.success('Product deleted successfully');
            setDeleteProductConfirm(null);
            fetchData();
        } catch (err) {
            toast.error('Failed to delete product');
        }
    };

    const togglePlan = async (product: string, month: string, week: number, currentVal: boolean) => {
        if (user?.role !== 'Admin') return;
        try {
            await mfgApi.updatePlan(product, month, year, week, !currentVal);
            fetchData();
        } catch (err) {
            toast.error("Failed to update plan");
        }
    };

    const handleExportCSV = () => {
        try {
            const headers = ['Product', 'Type', ...months.map(m => `${m}-${year % 100}`)];
            const rows: any[][] = [];
            products.forEach(prod => {
                const planRow = [prod, 'Plan'];
                months.forEach(m => {
                    const monthPlans = plans.filter(p => p.part_family === prod && p.month === m);
                    let planStr = '';
                    if (monthPlans.some(p => p.week_1_plan)) planStr += 'W-1 ';
                    if (monthPlans.some(p => p.week_2_plan)) planStr += 'W-2 ';
                    if (monthPlans.some(p => p.week_3_plan)) planStr += 'W-3 ';
                    if (monthPlans.some(p => p.week_4_plan)) planStr += 'W-4 ';
                    planRow.push(planStr.trim() || '-');
                });
                rows.push(planRow);
                const actualRow = [prod, 'Actual'];
                months.forEach(m => {
                    const monthIdx = months.indexOf(m);
                    const prodActuals = actuals.filter(a => {
                        const date = new Date(a.audit_date);
                        return a.part_name?.trim() === prod.trim() && date.getMonth() === monthIdx;
                    });
                    actualRow.push(prodActuals.map(a => new Date(a.audit_date).getDate()).join(' & ') || '-');
                });
                rows.push(actualRow);
            });
            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.setAttribute('download', `Manufacturing_Audit_Plan_${year}.csv`);
            link.click();
        } catch (err) {
            toast.error('Export failed');
        }
    };

    if (loading) {
        return (
            <Container fluid className="py-4">
                <Skeleton height={60} borderRadius="1rem" className="mb-4" />
                <Card className="border-0 shadow-sm rounded-4 overflow-hidden">
                    <Card.Body className="p-0">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="p-4 border-bottom d-flex gap-4">
                                <Skeleton width={150} height={20} />
                                <Skeleton height={20} />
                                <Skeleton width={100} height={20} />
                            </div>
                        ))}
                    </Card.Body>
                </Card>
            </Container>
        );
    }

    return (
        <Container fluid className="py-4 fade-in">
            <div className="d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3 mb-4">
                <div>
                    <h3 className="fw-bold text-gradient mb-1">Industrial Audit Management</h3>
                    <p className="text-muted small mb-0">Strategic quality scheduling across multiple manufacturing cycles.</p>
                </div>
                <div className="d-flex flex-wrap gap-2 align-items-center mt-2 mt-md-0">
                    <Form.Select
                        size="sm"
                        value={quarter}
                        onChange={(e) => setQuarter(e.target.value)}
                        className="rounded-3 fw-bold border-1 shadow-xs"
                        style={{ width: '120px' }}
                    >
                        <option value="All">Full Year</option>
                        <option value="1">Q1 (J-M)</option>
                        <option value="2">Q2 (A-J)</option>
                        <option value="3">Q3 (J-S)</option>
                        <option value="4">Q4 (O-D)</option>
                    </Form.Select>
                    <Form.Select
                        size="sm"
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="rounded-3 fw-bold border-1 shadow-xs"
                        style={{ width: '85px' }}
                    >
                        {[2025, 2026, 2027].map(y => <option key={y} value={y}>{y}</option>)}
                    </Form.Select>
                    {user?.role === 'Admin' && (
                        <div className="d-flex gap-2 ms-auto ms-md-0">
                            <Button variant="white" size="sm" className="border shadow-sm rounded-3 px-3 py-2 d-flex align-items-center gap-2 transition-all fw-bold" onClick={() => setShowAddModal(true)}>
                                <FaPlus size={12} className="text-primary" /> <span className="d-none d-sm-inline">Add</span>
                            </Button>
                            <Button variant="white" size="sm" className="border shadow-sm rounded-3 px-3 py-2 d-flex align-items-center gap-2 transition-all fw-bold" onClick={handleExportCSV}>
                                <FaDownload size={12} className="text-success" /> <span className="d-none d-sm-inline">Export</span>
                            </Button>
                        </div>
                    )}
                </div>
            </div>

            <Card className="shadow-sm border-0 rounded-4 overflow-hidden mb-5">
                <div className="table-responsive">
                    <Table bordered hover size="sm" className="text-center align-middle mb-0 table-premium">
                        <thead>
                            <tr className="bg-light">
                                <th rowSpan={2} className="sticky-col py-3 border-end bg-light" style={{ width: stickyWidth, minWidth: stickyWidth, maxWidth: stickyWidth, verticalAlign: 'middle', left: 0 }}>
                                    {isMobile ? 'Part Name' : 'Part Nomenclature'}
                                </th>
                                <th rowSpan={2} className="sticky-col bg-light border-end sticky-col-shadow" style={{ width: scopeWidth, minWidth: scopeWidth, maxWidth: scopeWidth, verticalAlign: 'middle', left: scopeLeft }}>Scope</th>
                                {filteredMonths.map(m => (
                                    <th key={m} className="py-3 small fw-bold text-uppercase tracking-wider" style={{ minWidth: '110px' }}>{m}-{year % 100}</th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {products.map(prod => (
                                <React.Fragment key={prod}>
                                    <tr>
                                        <td rowSpan={2} className="sticky-col fw-bold text-start ps-4 align-middle bg-white border-end" style={{ left: 0, width: stickyWidth, minWidth: stickyWidth, maxWidth: stickyWidth }}>
                                            <div className="d-flex justify-content-between align-items-center">
                                                <span className="text-indigo text-truncate" style={{ maxWidth: isMobile ? '90px' : '160px' }}>{prod}</span>
                                                {user?.role === 'Admin' && (
                                                    <FaTrash
                                                        className="text-danger cursor-pointer opacity-25 hover-opacity-100 transition-all"
                                                        size={12}
                                                        onClick={() => setDeleteProductConfirm(prod)}
                                                    />
                                                )}
                                            </div>
                                        </td>
                                        <td className="sticky-col small text-primary bg-light border-end py-2 fw-bold sticky-col-shadow" style={{ fontSize: '0.65rem', left: scopeLeft, width: scopeWidth, minWidth: scopeWidth, maxWidth: scopeWidth }}>PLAN</td>
                                        {filteredMonths.map(m => {
                                            const p = plans.find(entry => entry.part_family === prod && entry.month === m);
                                            return (
                                                <td key={`${prod}-${m}-plan`} className="p-2 border-bottom-dashed bg-white">
                                                    <div className="d-flex flex-wrap gap-1 justify-content-center px-1">
                                                        {[1, 2, 3, 4].map(w => {
                                                            const isPlanned = p?.[`week_${w}_plan` as keyof typeof p];
                                                            return (
                                                                <Badge
                                                                    key={w}
                                                                    bg={isPlanned ? "primary" : "white"}
                                                                    className={`cursor-pointer border py-1 px-1 ${!isPlanned ? 'text-muted opacity-25' : 'shadow-sm'}`}
                                                                    style={{ fontSize: '9px', minWidth: '28px' }}
                                                                    onClick={() => togglePlan(prod, m, w, !!isPlanned)}
                                                                >
                                                                    W-{w}
                                                                </Badge>
                                                            );
                                                        })}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                    <tr>
                                        <td className="sticky-col small text-dark bg-light border-end py-2 fw-bold sticky-col-shadow" style={{ fontSize: '0.65rem', left: scopeLeft, width: scopeWidth, minWidth: scopeWidth, maxWidth: scopeWidth }}>ACTUAL</td>
                                        {filteredMonths.map(m => {
                                            const monthIdx = months.indexOf(m);
                                            const prodActuals = actuals.filter(a => {
                                                const date = new Date(a.audit_date);
                                                return a.part_name?.trim() === prod.trim() && date.getMonth() === monthIdx;
                                            });
                                            return (
                                                <td key={`${prod}-${m}-actual`} className="p-2 bg-white">
                                                    <div className="d-flex flex-wrap gap-1 justify-content-center">
                                                        {prodActuals.map(a => (
                                                            <div key={a.audit_id} className="position-relative d-inline-block">
                                                                <Badge
                                                                    pill
                                                                    bg={a.status === 'Completed' ? "success" : "warning"}
                                                                    className="cursor-pointer shadow-xs d-flex align-items-center gap-1"
                                                                    style={{ fontSize: '10px', padding: '5px 8px' }}
                                                                    onClick={() => navigate(`/l1/audit/${a.audit_id}`)}
                                                                >
                                                                    {new Date(a.audit_date).getDate()}
                                                                </Badge>
                                                                {user?.role === 'Admin' && (
                                                                    <>
                                                                        <div
                                                                            className="position-absolute bg-primary text-white rounded-circle d-flex align-items-center justify-content-center cursor-pointer shadow-sm hover-scale transition-all"
                                                                            style={{
                                                                                top: '-6px',
                                                                                right: '10px',
                                                                                width: '16px',
                                                                                height: '16px',
                                                                                fontSize: '8px',
                                                                                border: '1px solid white',
                                                                                zIndex: 10
                                                                            }}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setEditDateAudit(a);
                                                                                setNewDate(new Date(a.audit_date).toISOString().split('T')[0]);
                                                                            }}
                                                                        >
                                                                            <FaEdit />
                                                                        </div>
                                                                        <div
                                                                            className="position-absolute bg-danger text-white rounded-circle d-flex align-items-center justify-content-center cursor-pointer shadow-sm hover-scale transition-all"
                                                                            style={{
                                                                                top: '-6px',
                                                                                right: '-6px',
                                                                                width: '16px',
                                                                                height: '16px',
                                                                                fontSize: '8px',
                                                                                border: '1px solid white',
                                                                                zIndex: 10
                                                                            }}
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                setDeleteAuditConfirm(a.audit_id);
                                                                            }}
                                                                        >
                                                                            <FaTimes />
                                                                        </div>
                                                                    </>
                                                                )}
                                                            </div>
                                                        ))}
                                                    </div>
                                                </td>
                                            );
                                        })}
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </Card>

            <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered className="fade">
                <Modal.Header closeButton className="border-0 pb-0"><Modal.Title className="fw-bold">Register Product Family</Modal.Title></Modal.Header>
                <Modal.Body className="pt-3">
                    <Form.Group>
                        <Form.Label className="small fw-bold text-muted text-uppercase mb-2">Part Name / Family Identity</Form.Label>
                        <Form.Control
                            type="text"
                            placeholder="Serrated FY Series"
                            value={newProductName}
                            onChange={(e) => setNewProductName(e.target.value)}
                            className="py-2 px-3 border-2"
                            style={{ borderRadius: '10px' }}
                        />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer className="border-0 pt-0">
                    <Button variant="light" className="px-4 fw-bold text-muted" onClick={() => setShowAddModal(false)}>Cancel</Button>
                    <Button variant="primary" className="px-4 fw-bold shadow-sm" onClick={handleAddProduct}>Confirm Registry</Button>
                </Modal.Footer>
            </Modal>

            <ConfirmationModal
                show={!!deleteProductConfirm}
                onClose={() => setDeleteProductConfirm(null)}
                onConfirm={handleDeleteProduct}
                title="Remove Strategic Asset"
                message={`Are you sure you want to unregister "${deleteProductConfirm}"? All historical plan data for this family will be discarded.`}
                confirmText="Confirm Removal"
                variant="danger"
            />

            <ConfirmationModal
                show={!!deleteAuditConfirm}
                onClose={() => setDeleteAuditConfirm(null)}
                onConfirm={handleDeleteAudit}
                title="Discard Historical Protocol"
                message="Are you sure you want to permanently delete this audit record? All associated checklist data and Non-Conformances will be lost."
                confirmText="Permanently Delete"
                variant="danger"
            />

            <Modal show={!!editDateAudit} onHide={() => setEditDateAudit(null)} centered>
                <Modal.Header closeButton><Modal.Title>Reschedule Audit</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label className="small fw-bold">New Date for {editDateAudit?.machine_name}</Form.Label>
                        <Form.Control type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setEditDateAudit(null)}>Cancel</Button>
                    <Button variant="primary" onClick={handleUpdateDate}>Update Schedule</Button>
                </Modal.Footer>
            </Modal>

            <ConfirmationModal
                show={!!scheduleConfirm}
                onClose={() => setScheduleConfirm(null)}
                onConfirm={handleSchedule}
                title="Manual Audit Insertion"
                message={`Schedule an unscheduled Manufacturing Audit for ${scheduleConfirm?.product} in ${scheduleConfirm?.month}?`}
                confirmText="Insert Audit"
                variant="primary"
            />

            {(() => {
                const summaryData = months.map((m) => {
                    const monthIdx = months.indexOf(m);
                    const actualForMonth = actuals.filter(a => {
                        const date = new Date(a.audit_date);
                        return date.getMonth() === monthIdx && date.getFullYear() === year && a.status === 'Completed';
                    }).length;

                    const plannedCount = products.reduce((acc, prod) => {
                        const p = plans.find(entry => entry.part_family === prod && entry.month === m);
                        let count = 0;
                        if (p?.week_1_plan) count++;
                        if (p?.week_2_plan) count++;
                        if (p?.week_3_plan) count++;
                        if (p?.week_4_plan) count++;
                        return acc + count;
                    }, 0);

                    return { month: m, plan: plannedCount, actual: actualForMonth, nc: 0 };
                });

                const totalPlan = summaryData.reduce((acc, curr) => acc + curr.plan, 0);
                const totalActual = summaryData.reduce((acc, curr) => acc + curr.actual, 0);

                return (
                    <Card className="mt-5 border-0 shadow-sm overflow-hidden rounded-4" style={{ maxWidth: '650px' }}>
                        <Card.Header className="bg-white py-3 border-bottom">
                            <h5 className="mb-0 fw-bold">Manufacturing Audit Summary - {year}</h5>
                        </Card.Header>
                        <Table responsive hover className="mb-0 text-center align-middle">
                            <thead className="table-light">
                                <tr>
                                    <th>Sr no</th>
                                    <th>Months</th>
                                    <th>Total Plan</th>
                                    <th>Total Actual</th>
                                    <th>No. Of NC</th>
                                </tr>
                            </thead>
                            <tbody>
                                {summaryData.map((s, i) => (
                                    <tr key={s.month}>
                                        <td>{i + 1}</td>
                                        <td className="fw-bold">{s.month}</td>
                                        <td>{s.plan}</td>
                                        <td>{s.actual}</td>
                                        <td>{s.nc}</td>
                                    </tr>
                                ))}
                                <tr className="table-primary border-top-2">
                                    <td colSpan={2} className="fw-bold text-end pe-4">Total</td>
                                    <td className="fw-bold">{totalPlan}</td>
                                    <td className="fw-bold">{totalActual}</td>
                                    <td className="fw-bold">0</td>
                                </tr>
                            </tbody>
                        </Table>
                    </Card>
                );
            })()}
        </Container>
    );
};

export default ManufacturingProductAuditPlan;
