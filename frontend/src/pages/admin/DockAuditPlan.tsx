import React, { useEffect, useState } from 'react';
import { Container, Table, Badge, Form, Modal, Button, Stack, Card } from 'react-bootstrap';
import { dockApi } from '../../api/dock';
import { useAuth } from '../../context/AuthContext.tsx';
import { useNavigate } from 'react-router-dom';
import api from '../../api/axios';
import { toast } from 'react-toastify';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import Skeleton from '../../components/common/Skeleton';
import { FaEdit, FaPlus, FaTrash, FaDownload, FaTimes } from 'react-icons/fa';

const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const DockAuditPlan = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const [actualAudits, setActualAudits] = useState<any[]>([]);
    const [plannedAudits, setPlannedAudits] = useState<any[]>([]);
    const [products, setProducts] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
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
    const [year, setYear] = useState(new Date().getFullYear());

    // Rescheduling & Manual Scheduling State
    const [editDateAudit, setEditDateAudit] = useState<any | null>(null);
    const [newDate, setNewDate] = useState<string>('');
    const [scheduleConfirm, setScheduleConfirm] = useState<{ product: string, month: string, week: number } | null>(null);
    const [deleteAuditConfirm, setDeleteAuditConfirm] = useState<string | null>(null);

    // Product Management State
    const [showAddModal, setShowAddModal] = useState(false);
    const [newProductName, setNewProductName] = useState('');
    const [deleteProductConfirm, setDeleteProductConfirm] = useState<string | null>(null);

    useEffect(() => {
        fetchData();
    }, [year]);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [pRes, prodList] = await Promise.all([
                dockApi.getPlan(year),
                dockApi.getProducts()
            ]);
            setActualAudits(pRes.actuals);
            setPlannedAudits(pRes.plan);
            setProducts(prodList);
        } catch (err) {
            console.error(err);
            toast.error("Failed to load dock audit plan");
        } finally {
            setLoading(false);
        }
    };

    const handleUpdateDate = async () => {
        if (!editDateAudit || !newDate) return;
        try {
            await api.patch(`/audits/${editDateAudit.audit_id}/dates`, { audit_date: newDate });
            toast.success('Audit date updated!');
            fetchData();
            setEditDateAudit(null);
        } catch (err) {
            toast.error('Failed to update audit date');
        }
    };

    const togglePlan = async (product: string, month: string, week: number, currentVal: boolean) => {
        if (user?.role !== 'Admin') return;
        try {
            await dockApi.updatePlan(product, month, year, week, !currentVal);
            fetchData();
        } catch (err) {
            toast.error("Failed to update plan");
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

    const handleSchedule = async () => {
        if (!scheduleConfirm) return;
        const { product, month, week } = scheduleConfirm;
        try {
            const tRes = await api.get('/templates');
            const template = tRes.data.find((t: any) => t.template_name === 'Dock Audit');
            if (!template) {
                toast.error('Dock Audit Template not found');
                return;
            }

            // Calculate a default date for the selected week
            const monthIdx = months.indexOf(month);
            const day = (week - 1) * 7 + 5;
            const audit_date = new Date(year, monthIdx, day).toISOString().split('T')[0];

            const l1Res = await api.get('/users?role=L1_Auditor');
            const l2Res = await api.get('/users?role=L2_Auditor');
            const poRes = await api.get('/users?role=Process_Owner');

            const newAuditRes = await api.post('/audits/schedule', {
                template_id: template.template_id,
                machine_name: 'DOCK-AREA',
                audit_date: audit_date,
                shift: 'A',
                l1_auditor_id: l1Res.data?.[0]?.user_id || user?.user_id,
                l2_auditor_id: l2Res.data?.[0]?.user_id || user?.user_id,
                process_owner_id: poRes.data?.[0]?.user_id || user?.user_id,
                operation: 'Dock Audit',
                part_name: product,
                part_number: 'N/A',
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
            await dockApi.addProduct(newProductName.trim());
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
            await dockApi.deleteProduct(deleteProductConfirm);
            toast.success('Product deleted successfully');
            setDeleteProductConfirm(null);
            fetchData();
        } catch (err) {
            toast.error('Failed to delete product');
        }
    };

    const handleExportCSV = () => {
        try {
            const headers = ['Product', 'Type', ...months.map(m => `${m}-${year % 100}`)];
            const rows: any[][] = [];
            products.forEach(prod => {
                const planRow = [prod, 'Plan'];
                months.forEach(m => {
                    const planEntry = plannedAudits.find(p => p.part_family === prod && p.month === m);
                    if (planEntry) {
                        const plannedWeeks = [];
                        if (planEntry.week_1_plan) plannedWeeks.push('W1');
                        if (planEntry.week_2_plan) plannedWeeks.push('W2');
                        if (planEntry.week_3_plan) plannedWeeks.push('W3');
                        if (planEntry.week_4_plan) plannedWeeks.push('W4');
                        planRow.push(plannedWeeks.join(', ') || '-');
                    } else {
                        planRow.push('-');
                    }
                });
                rows.push(planRow);
                const actualRow = [prod, 'Actual'];
                months.forEach(m => {
                    const monthIdx = months.indexOf(m);
                    const actuals = actualAudits.filter((a: any) => {
                        const date = new Date(a.audit_date);
                        return a.part_name?.toLowerCase().trim() === prod.toLowerCase().trim() &&
                            date.getMonth() === monthIdx &&
                            date.getFullYear() === year;
                    });
                    actualRow.push(actuals.map((a: any) => new Date(a.audit_date).getDate()).join(', ') || '-');
                });
                rows.push(actualRow);
            });
            const csvContent = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
            const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement('a');
            const url = URL.createObjectURL(blob);
            link.setAttribute('href', url);
            link.setAttribute('download', `Dock_Audit_Plan_${year}.csv`);
            link.style.visibility = 'hidden';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            toast.success('CSV Downloaded!');
        } catch (err) {
            toast.error('Failed to export CSV');
        }
    };

    const renderPlanCell = (product: string, month: string) => {
        const p = plannedAudits.find(entry => entry.part_family === product && entry.month === month);
        return (
            <div className="d-flex flex-wrap gap-1 justify-content-center px-1">
                {[1, 2, 3, 4].map(w => {
                    const isPlanned = p?.[`week_${w}_plan` as keyof typeof p];
                    return (
                        <Badge
                            key={w}
                            bg={isPlanned ? "primary" : "white"}
                            className={`cursor-pointer border py-1 px-2 ${!isPlanned ? 'text-muted opacity-25' : 'shadow-sm'}`}
                            style={{ fontSize: '9px', minWidth: '35px' }}
                            onClick={() => togglePlan(product, month, w, !!isPlanned)}
                        >
                            W-{w}
                        </Badge>
                    );
                })}
            </div>
        );
    };

    const renderActualCell = (product: string, month: string) => {
        const monthIdx = months.indexOf(month);
        const actuals = actualAudits.filter((a: any) => {
            const date = new Date(a.audit_date);
            return a.part_name?.toLowerCase().trim() === product.toLowerCase().trim() &&
                date.getMonth() === monthIdx &&
                date.getFullYear() === year;
        });

        return (
            <div className="d-flex flex-wrap justify-content-center gap-1 align-items-center">
                {actuals.map((a: any) => (
                    <div key={a.audit_id} className="position-relative d-inline-block">
                        <Badge
                            pill
                            bg={a.status === 'Completed' ? "success" : "warning"}
                            className="cursor-pointer d-flex align-items-center gap-1"
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
                {/* Manual scheduling removed per user request */}
            </div>
        );
    };

    const renderSummaryTable = () => {
        const summaryData = months.map((m) => {
            const monthIdx = months.indexOf(m);
            const actualForMonth = actualAudits.filter(a => {
                const date = new Date(a.audit_date);
                return date.getMonth() === monthIdx && date.getFullYear() === year && a.status === 'Completed';
            }).length;

            // Count weekly plans across all products
            const plannedCount = products.reduce((acc, prod) => {
                const p = plannedAudits.find(entry => entry.part_family === prod && entry.month === m);
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
            <Card className="mt-5 border-0 shadow-sm overflow-hidden rounded-4" style={{ maxWidth: '600px' }}>
                <Card.Header className="bg-white py-3 border-bottom d-flex justify-content-between align-items-center">
                    <h5 className="mb-0 fw-bold">Dock Audit Summary - {year}</h5>
                    <Badge bg="primary-light" className="text-primary px-3 py-2">
                        Annual Performance Check
                    </Badge>
                </Card.Header>
                <Table responsive hover className="mb-0 text-center align-middle">
                    <thead className="bg-light">
                        <tr>
                            <th className="py-3 text-uppercase small fw-bold text-dark">Metric</th>
                            {months.map(m => (
                                <th key={m} className="py-3 text-uppercase small fw-bold text-dark">{m}</th>
                            ))}
                            <th className="py-3 text-uppercase small fw-bold text-primary">Total</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr>
                            <td className="fw-bold text-muted small text-start ps-4">TOTAL PLAN</td>
                            {summaryData.map((d, i) => (
                                <td key={i}>{d.plan}</td>
                            ))}
                            <td className="fw-bold text-primary">{totalPlan}</td>
                        </tr>
                        <tr>
                            <td className="fw-bold text-muted small text-start ps-4">TOTAL ACTUAL</td>
                            {summaryData.map((d, i) => (
                                <td key={i}>{d.actual}</td>
                            ))}
                            <td className="fw-bold text-success">{totalActual}</td>
                        </tr>
                        <tr className="bg-light-subtle">
                            <td className="fw-bold text-muted small text-start ps-4">COMPLIANCE</td>
                            {summaryData.map((d, i) => {
                                const rate = d.plan > 0 ? Math.round((d.actual / d.plan) * 100) : 0;
                                return (
                                    <td key={i} className={`fw-bold ${rate >= 100 ? 'text-success' : rate >= 50 ? 'text-warning' : 'text-danger'}`}>
                                        {rate}%
                                    </td>
                                );
                            })}
                            <td className="fw-bold text-dark">
                                {totalPlan > 0 ? Math.round((totalActual / totalPlan) * 100) : 0}%
                            </td>
                        </tr>
                    </tbody>
                </Table>
            </Card>
        );
    };

    if (loading && products.length === 0) {
        return (
            <Container fluid className="p-4">
                <Skeleton height="100px" className="mb-4" />
                <Skeleton height="400px" />
            </Container>
        );
    }

    return (
        <Container fluid className="p-4 fade-in">
            <Stack direction="horizontal" gap={3} className="mb-4 align-items-center">
                <div>
                    <h3 className="fw-bold text-gradient mb-1">Dock Audit Management</h3>
                    <p className="text-muted small mb-0">Global product compliance tracking and scheduling.</p>
                </div>
                <div className="ms-auto d-flex gap-2">
                    {user?.role === 'Admin' && (
                        <Button variant="outline-primary" onClick={() => setShowAddModal(true)} className="d-flex align-items-center gap-2 px-3 shadow-xs">
                            <FaPlus /> Add Product
                        </Button>
                    )}
                    <Button variant="success" onClick={handleExportCSV} className="d-flex align-items-center gap-2 px-4 shadow-xs">
                        <FaDownload /> Export CSV
                    </Button>
                    <Form.Select
                        value={year}
                        onChange={(e) => setYear(parseInt(e.target.value))}
                        className="w-auto border-0 bg-light shadow-xs fw-bold"
                    >
                        {[2024, 2025, 2026].map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </Form.Select>
                </div>
            </Stack>

            <Card className="border-0 shadow-sm overflow-hidden rounded-4">
                <div className="table-responsive">
                    <Table bordered hover size="sm" className="text-center align-middle mb-0 table-premium">
                        <thead className="table-light">
                            <tr>
                                <th rowSpan={2} className="sticky-col py-3 border-end bg-light" style={{ width: stickyWidth, minWidth: stickyWidth, maxWidth: stickyWidth, verticalAlign: 'middle', left: 0 }}>
                                    {isMobile ? 'Part Name' : 'Part Nomenclature'}
                                </th>
                                <th rowSpan={2} className="sticky-col bg-light border-end sticky-col-shadow" style={{ width: scopeWidth, minWidth: scopeWidth, maxWidth: scopeWidth, verticalAlign: 'middle', left: scopeLeft }}>Scope</th>
                                {months.map(m => (
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
                                                <span className="text-truncate" style={{ maxWidth: isMobile ? '90px' : '160px' }}>{prod}</span>
                                                {user?.role === 'Admin' && (
                                                    <FaTrash
                                                        className="text-danger cursor-pointer opacity-25 hover-opacity-100 transition-all"
                                                        size={12}
                                                        onClick={() => setDeleteProductConfirm(prod)}
                                                    />
                                                )}
                                            </div>
                                        </td>
                                        <td className="sticky-col small text-primary bg-light border-end py-2 fw-bold sticky-col-shadow" style={{ left: scopeLeft, width: scopeWidth, minWidth: scopeWidth, maxWidth: scopeWidth }}>PLAN</td>
                                        {months.map(m => (
                                            <td key={`${prod}-${m}-plan`} className="p-2 border-bottom-dashed">
                                                {renderPlanCell(prod, m)}
                                            </td>
                                        ))}
                                    </tr>
                                    <tr>
                                        <td className="sticky-col small text-dark bg-light border-end py-2 fw-bold sticky-col-shadow" style={{ left: scopeLeft, width: scopeWidth, minWidth: scopeWidth, maxWidth: scopeWidth }}>ACTUAL</td>
                                        {months.map(m => (
                                            <td key={`${prod}-${m}-actual`} className="p-2">
                                                {renderActualCell(prod, m)}
                                            </td>
                                        ))}
                                    </tr>
                                </React.Fragment>
                            ))}
                        </tbody>
                    </Table>
                </div>
            </Card>

            {renderSummaryTable()}

            <Modal show={!!editDateAudit} onHide={() => setEditDateAudit(null)} centered>
                <Modal.Header closeButton><Modal.Title>Reschedule Audit</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label className="small fw-bold">New Date for {editDateAudit?.part_name}</Form.Label>
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
                message={`Schedule an unscheduled Dock Audit for ${scheduleConfirm?.product} in ${scheduleConfirm?.month}?`}
                confirmText="Insert Audit"
                variant="primary"
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

            <Modal show={showAddModal} onHide={() => setShowAddModal(false)} centered>
                <Modal.Header closeButton><Modal.Title>Register New Product</Modal.Title></Modal.Header>
                <Modal.Body>
                    <Form.Group>
                        <Form.Label className="small fw-bold">Product Nomenclature</Form.Label>
                        <Form.Control type="text" placeholder="SERRATED FY" value={newProductName} onChange={(e) => setNewProductName(e.target.value)} />
                    </Form.Group>
                </Modal.Body>
                <Modal.Footer>
                    <Button variant="light" onClick={() => setShowAddModal(false)}>Cancel</Button>
                    <Button variant="primary" onClick={handleAddProduct} disabled={!newProductName.trim()}>Confirm Registry</Button>
                </Modal.Footer>
            </Modal>

            <ConfirmationModal
                show={!!deleteProductConfirm}
                onClose={() => setDeleteProductConfirm(null)}
                onConfirm={handleDeleteProduct}
                title="Remove Product"
                message={`Unregister "${deleteProductConfirm}" from the global audit plan?`}
                confirmText="Unregister"
                variant="danger"
            />
        </Container>
    );
};

export default DockAuditPlan;
