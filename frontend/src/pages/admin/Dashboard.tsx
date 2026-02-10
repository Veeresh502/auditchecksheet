import { useState, useEffect } from 'react';
import { Container, Table, Badge, Form, Card } from 'react-bootstrap';
import { FaSearch } from 'react-icons/fa';
import api from '../../api/axios';
import AuditDetailsModal from '../../components/audit/AuditDetailsModal';
import ConfirmationModal from '../../components/common/ConfirmationModal';
import { toast } from 'react-toastify';
import * as XLSX from 'xlsx';

const AdminDashboard = () => {
  const [audits, setAudits] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);

  // DETAILS MODAL STATE
  const [showDetailsModal, setShowDetailsModal] = useState(false);
  const [selectedAudit, setSelectedAudit] = useState<any>(null);

  // DELETE STATE
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/audits/admin/all');
      setAudits(res.data);
    } catch (err) {
      console.error("Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  // Custom Sort Logic: NC Open -> Assigned -> Submitted -> Completed
  const sortOrder: { [key: string]: number } = {
    'NC_Open': 1,
    'NC_Pending_Verify': 1, // Treat same priority
    'Assigned': 2,
    'Submitted_to_L2': 3,
    'Rejected': 0, // Highest priority
    'Completed': 4
  };

  const sortedAudits = [...audits].sort((a: any, b: any) => {
    const orderA = sortOrder[a.status] || 99;
    const orderB = sortOrder[b.status] || 99;
    return orderA - orderB;
  });

  const filteredAudits = sortedAudits.filter((a: any) =>
    a.machine_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.template_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    a.status?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleRowClick = (audit: any) => {
    setSelectedAudit(audit);
    setShowDetailsModal(true);
  };

  const handleExportExcel = async (id: string) => {
    try {
      const response = await api.get(`/audits/${id}/full`);
      const { audit, data, non_conformances } = response.data;

      const auditInfo = [
        ["Field", "Value"],
        ["Audit ID", audit.audit_id],
        ["Machine", audit.machine_name],
        ["Template", audit.template_name],
        ["Date", new Date(audit.audit_date).toLocaleDateString()],
        ["Shift", audit.shift],
        ["Status", audit.status],
        ["L1 Auditor", audit.l1_auditor_name],
        ["L2 Auditor", audit.l2_auditor_name],
        ["Process Owner", audit.process_owner_name],
      ];

      const checklistHeader = ["Section", "Question", "L1 Observation", "Score", "Remarks"];
      const checklistRows = data.checklist.map((item: any) => [
        item.section_name,
        item.question_text,
        item.l1_observation || 'N/A',
        item.l2_score === 3 ? 'NA' : item.l2_score === 2 ? 'OK' : item.l2_score === 1 ? 'Obs' : 'NC',
        item.l2_remarks || ''
      ]);

      const ncHeader = ["NC ID", "Issue", "Risk Level", "Target Date", "Status"];
      const ncRows = (non_conformances || []).map((nc: any) => [
        nc.nc_id,
        nc.issue_description,
        nc.risk_level,
        new Date(nc.target_date).toLocaleDateString(),
        nc.status
      ]);

      const wb = XLSX.utils.book_new();
      const wsInfo = XLSX.utils.aoa_to_sheet(auditInfo);
      XLSX.utils.book_append_sheet(wb, wsInfo, "Audit Summary");
      const wsChecklist = XLSX.utils.aoa_to_sheet([checklistHeader, ...checklistRows]);
      XLSX.utils.book_append_sheet(wb, wsChecklist, "Checklist Observations");
      if (ncRows.length > 0) {
        const wsNC = XLSX.utils.aoa_to_sheet([ncHeader, ...ncRows]);
        XLSX.utils.book_append_sheet(wb, wsNC, "Non Conformances");
      }
      XLSX.writeFile(wb, `Audit_Report_${id}.xlsx`);
      toast.success("Excel Downloaded!");
    } catch (err) {
      console.error("Excel Export failed", err);
      toast.error("Failed to download Excel report");
    }
  };

  const handleDeleteRequest = () => {
    // Close detail modal, open confirmation
    setShowDetailsModal(false);
    setShowDeleteConfirm(true);
    // selectedAudit is already set
  };

  const handleDeleteConfirm = async () => {
    if (!selectedAudit) return;
    setDeleting(true);
    try {
      await api.delete(`/audits/${selectedAudit.audit_id}`);
      toast.success("Audit deleted successfully");
      fetchData();
      setShowDeleteConfirm(false);
      setSelectedAudit(null);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to delete audit");
    } finally {
      setDeleting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    let badgeClass = 'badge-info-subtle';
    switch (status) {
      case 'Completed': badgeClass = 'badge-success-subtle'; break;
      case 'NC_Open': badgeClass = 'badge-danger-subtle'; break;
      case 'Submitted_to_L2': badgeClass = 'badge-warning-subtle'; break; // Changed to warning for visibility
      case 'NC_Pending_Verify': badgeClass = 'badge-warning-subtle'; break;
      case 'Rejected': badgeClass = 'badge-danger-subtle'; break;
      case 'Assigned': badgeClass = 'badge-primary-subtle'; break;
      default: badgeClass = 'badge-info-subtle'; break;
    }
    return (
      <Badge bg="light" text="dark" className={`badge-premium ${badgeClass} border-0`}>
        {status.replace(/_/g, ' ')}
      </Badge>
    );
  };

  return (
    <Container fluid className="py-4 fade-in px-0 px-md-3">
      <div className="d-flex justify-content-between align-items-center mb-4 px-3 px-md-0">
        <div>
          <h2 className="fw-bold mb-1">Administrator Dashboard</h2>
          <p className="text-muted small mb-0">Overview of all system activity.</p>
        </div>
      </div>

      <Card className="border-0 shadow-sm rounded-4 overflow-hidden mb-5">
        <Card.Body className="p-0">

          {/* Mobile-Friendlier Search Bar */}
          <div className="p-3 bg-light border-bottom">
            <div className="input-group">
              <span className="input-group-text bg-white border-end-0"><FaSearch className="text-muted" /></span>
              <Form.Control
                placeholder="Search audits..."
                className="border-start-0"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
          </div>

          <div className="table-responsive">
            <Table hover className="mb-0 align-middle">
              <thead className="table-light">
                <tr>
                  <th className="ps-4 py-3">Date</th>
                  <th className="py-3">Machine / Asset</th>
                  <th className="py-3">Checklist Type</th>
                  <th className="py-3 pe-4 text-center">Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredAudits.map((a: any) => (
                  <tr
                    key={a.audit_id}
                    onClick={() => handleRowClick(a)}
                    style={{ cursor: 'pointer' }}
                    className="hover-row"
                  >
                    <td className="ps-4 text-nowrap">{new Date(a.audit_date).toLocaleDateString()}</td>
                    <td className="fw-medium text-dark">{a.machine_name}</td>
                    <td className="text-muted small text-uppercase">{a.template_name?.replace(' Audit', '')}</td>
                    <td className="text-center pe-4">{getStatusBadge(a.status)}</td>
                  </tr>
                ))}
                {filteredAudits.length === 0 && !loading && (
                  <tr><td colSpan={4} className="text-center py-5 text-muted">No audits found.</td></tr>
                )}
              </tbody>
            </Table>
          </div>
        </Card.Body>
      </Card>

      <AuditDetailsModal
        show={showDetailsModal}
        onHide={() => setShowDetailsModal(false)}
        audit={selectedAudit}
        onDownloadExcel={handleExportExcel}
        onDelete={handleDeleteRequest}
        isDeleting={false} // Loading state handled globally for simplicity or add local state if needed
      />

      <ConfirmationModal
        show={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        onConfirm={handleDeleteConfirm}
        title="Delete Audit"
        message="Are you sure you want to delete this audit? This action cannot be undone."
        confirmText={deleting ? "Deleting..." : "Delete"}
        variant="danger"
      />
    </Container>
  );
};

export default AdminDashboard;
