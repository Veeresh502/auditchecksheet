import { useEffect, useState } from 'react';
import { Table, Form, Button, Row, Col, Badge, Modal } from 'react-bootstrap';
import { FaPlus, FaExclamationTriangle, FaTrash, FaCheckDouble } from 'react-icons/fa';
import api from '../../../api/axios';
import FilePreview from '../../common/FilePreview';
import { toast } from 'react-toastify';

interface Props {
  auditId: string;
  initialData: any[];
  ncs: any[];
  readOnly: boolean;
  onRefresh: () => void;
}

const CalibrationTab = ({ auditId, initialData, ncs, readOnly, onRefresh }: Props) => {
  const [rows, setRows] = useState(initialData || []);

  // New Entry State
  const [newInstrument, setNewInstrument] = useState('');
  const [newDate, setNewDate] = useState('');
  const [newGrr, setNewGrr] = useState('');
  const [newRemarks, setNewRemarks] = useState('');

  // NC Modal State
  const [showNCModal, setShowNCModal] = useState(false);
  const [ncDescription, setNcDescription] = useState('');
  const [issueImageUrl, setIssueImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedCalibrationId, setSelectedCalibrationId] = useState<string>('');
  const [selectedInstrumentName, setSelectedInstrumentName] = useState<string>('');

  // Verification State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<any>(null);

  const getNC = (calId: string) => {
    return ncs?.find(nc => nc.question_id === calId && nc.status !== 'Closed');
  };

  const openVerification = (nc: any) => {
    setVerifyTarget(nc);
    setShowVerifyModal(true);
  };

  const confirmVerification = async () => {
    if (!verifyTarget) return;
    try {
      await api.post(`/nc/${verifyTarget.nc_id}/verify`);
      setShowVerifyModal(false);
      onRefresh();
    } catch (err) { toast.error("Verification failed"); }
  };

  useEffect(() => {
    // Sync with initialData only on mount or if data exists
    if (initialData && initialData.length > 0) {
      setRows(initialData);
    }
  }, [initialData]);

  const handleNCPictureUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/upload', formData);
      setIssueImageUrl(res.data.url);
      toast.success("Picture attached");
    } catch (err: any) {
      console.error("NC Upload Error:", err);
      toast.error("Upload failed");
    } finally {
      setIsUploading(false);
    }
  };

  const handleRaiseNC = async () => {
    if (!ncDescription) {
      toast.error("Please provide NC description");
      return;
    }
    try {
      await api.post(`/nc`, {
        audit_id: auditId,
        question_id: selectedCalibrationId || `cal_${selectedInstrumentName}`,
        issue_description: `Calibration Instrument: ${selectedInstrumentName} - ${ncDescription}`,
        issue_image_url: issueImageUrl
      });
      setShowNCModal(false);
      setNcDescription('');
      setIssueImageUrl(null);
      toast.success("NC Raised successfully!");
      onRefresh(); // Refresh parent to synchronize NC state
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to raise NC");
    }
  };

  const handleSave = async (item: any) => {
    if (readOnly) return;
    try {
      const res = await api.post('/answers/calibration', {
        ...item,
        audit_id: auditId
      });

      const savedData = res.data;

      // Update local state with the returned ID and data
      setRows((prev: any[]) =>
        prev.map(r => {
          const isMatch = (r.calibration_id && r.calibration_id === savedData.calibration_id) ||
            (!r.calibration_id && r.instrument_name === item.instrument_name);
          return isMatch ? { ...r, ...savedData } : r;
        })
      );

      toast.success("Saved");
      // REMOVED onRefresh() here to prevent UI flickering on every blur.
      return savedData;
    } catch (err) {
      console.error("Failed to save calibration:", err);
      toast.error("Failed to save");
      throw err;
    }
  };

  const handleAddRow = async () => {
    if (readOnly) return;
    if (!newInstrument || !newDate) return;

    try {
      const res = await api.post('/answers/calibration', {
        audit_id: auditId,
        instrument_name: newInstrument,
        due_date: newDate,
        grr_details: newGrr,
        remarks: newRemarks
      });

      setNewInstrument('');
      setNewDate('');
      setNewGrr('');
      setNewRemarks('');
      toast.success("Calibration record added");
      onRefresh();

      if (newRemarks === 'NOT OK') {
        setSelectedCalibrationId(res.data.calibration_id);
        setSelectedInstrumentName(newInstrument);
        setShowNCModal(true);
      }
    } catch (err) {
      toast.error("Failed to add record");
    }
  };

  const handleDelete = async (id: string) => {
    if (readOnly) return;
    if (!window.confirm("Delete this calibration record?")) return;
    try {
      await api.delete(`/answers/calibration/${id}`);
      toast.success("Deleted");
      onRefresh();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const handleRemarksChange = async (item: any, value: string) => {
    // Update local state immediately for UI responsiveness
    setRows((prev: any[]) =>
      prev.map(r => r.calibration_id === item.calibration_id ||
        (!r.calibration_id && r.instrument_name === item.instrument_name)
        ? { ...r, remarks: value } : r)
    );

    if (value === 'NOT OK' && !readOnly) {
      try {
        let currentItem = { ...item, remarks: value };
        if (!currentItem.calibration_id) {
          // Force save to get valid UUID before raising NC
          const saved = await handleSave(currentItem);
          currentItem.calibration_id = saved.calibration_id;
        } else {
          await handleSave(currentItem);
        }

        setSelectedCalibrationId(currentItem.calibration_id);
        setSelectedInstrumentName(currentItem.instrument_name);
        setShowNCModal(true);
      } catch (err) {
        console.error("Failed to prepare NC:", err);
      }
    } else if (!readOnly) {
      handleSave({ ...item, remarks: value });
    }
  };

  const isExpired = (dateString: string) => {
    return new Date(dateString) < new Date();
  };

  return (
    <div className="mb-4">
      <h5 className="text-primary fw-bold border-bottom pb-2 mb-3">
        Calibration Status of Instruments
      </h5>

      <div className="alert alert-light border p-2 mb-3 small text-muted"> <small>THE GRR DETAILS CAN BE OBTAINED FROM STANDARDS ROOM</small> </div>

      <Table bordered hover className="align-middle shadow-sm">
        <thead className="table-light">
          <tr>
            <th>Instrument / Gauge Name</th>
            <th style={{ width: '180px' }}>Due Date</th>
            <th>GRR Details</th>
            <th style={{ width: '150px' }}>Remarks</th>
            <th style={{ width: '100px' }}>Status</th>
            <th style={{ width: '50px' }}></th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row: any, idx: number) => {
            const expired = isExpired(row.due_date);
            const activeNC = getNC(row.calibration_id);
            return (
              <tr key={idx} className={activeNC ? "table-warning" : (expired ? "table-danger" : "")}>
                <td>
                  <Form.Control
                    size="sm"
                    plaintext={readOnly}
                    readOnly={readOnly}
                    value={row.instrument_name || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRows(rows.map((r, i) => i === idx ? { ...r, instrument_name: val } : r));
                    }}
                    onBlur={() => handleSave(row)}
                  />
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    type="date"
                    disabled={readOnly}
                    value={row.due_date ? new Date(row.due_date).toISOString().split('T')[0] : ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRows(rows.map((r, i) => i === idx ? { ...r, due_date: val } : r));
                    }}
                    onBlur={() => handleSave(row)}
                  />
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    disabled={readOnly}
                    value={row.grr_details || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setRows(rows.map((r, i) => i === idx ? { ...r, grr_details: val } : r));
                    }}
                    onBlur={() => handleSave(row)}
                  />
                </td>
                <td>
                  <Form.Select
                    size="sm"
                    disabled={readOnly}
                    value={row.remarks || ''}
                    onChange={(e) => handleRemarksChange(row, e.target.value)}
                  >
                    <option value="">Select...</option>
                    <option value="OK">OK</option>
                    <option value="NOT OK">NOT OK</option>
                  </Form.Select>
                </td>
                <td className="text-center">
                  {expired ? (
                    <Badge bg="danger">EXPIRED</Badge>
                  ) : (
                    <Badge bg="success">VALID</Badge>
                  )}
                </td>
                <td>
                  {activeNC ? (
                    activeNC.status === 'Pending_Verification' ? (
                      <Button variant="success" size="sm" onClick={() => openVerification(activeNC)}>
                        <FaCheckDouble /> Verify
                      </Button>
                    ) : <span className="badge bg-danger">NC OPEN</span>
                  ) : (
                    <Button
                      variant="link"
                      className="text-danger p-0"
                      onClick={() => handleDelete(row.calibration_id)}
                      disabled={readOnly}
                    >
                      <FaTrash />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}

          {rows.length === 0 && (
            <tr>
              <td colSpan={6} className="text-center text-muted p-4">
                No instruments recorded.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {!readOnly && (
        <div className="bg-light p-3 rounded border">
          <h6 className="fw-bold mb-3 text-primary">Add Instrument</h6>
          <Row className="g-2">
            <Col md={3}>
              <Form.Control
                placeholder="Instrument Name"
                value={newInstrument}
                onChange={e => setNewInstrument(e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Form.Control
                type="date"
                value={newDate}
                onChange={e => setNewDate(e.target.value)}
              />
            </Col>
            <Col md={2}>
              <Form.Control
                placeholder="GRR Details"
                value={newGrr}
                onChange={e => setNewGrr(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Select
                value={newRemarks}
                onChange={e => setNewRemarks(e.target.value)}
              >
                <option value="">Select...</option>
                <option value="OK">OK</option>
                <option value="NOT OK">NOT OK</option>
              </Form.Select>
            </Col>
            <Col md={2}>
              <Button
                variant="primary"
                className="w-100"
                onClick={handleAddRow}
              >
                <FaPlus className="me-1" /> Add
              </Button>
            </Col>
          </Row>
        </div>
      )}


      {/* Verification Modal */}
      <Modal show={showVerifyModal} onHide={() => setShowVerifyModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-success text-white">
          <Modal.Title>Verify Corrective Action</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {verifyTarget && (
            <div className="d-flex flex-column gap-3">
              <div className="p-3 bg-light rounded">
                <div className="mb-2"><strong className="text-danger">Issue:</strong> {verifyTarget.issue_description}</div>
                {verifyTarget.issue_image_url && (
                  <div style={{ maxWidth: '300px' }}>
                    <FilePreview fileUrl={verifyTarget.issue_image_url} />
                  </div>
                )}
              </div>

              <div className="border p-3 rounded">
                <h6 className="fw-bold text-primary">Process Owner's Resolution:</h6>
                <p><strong>Root Cause:</strong> {verifyTarget.root_cause}</p>
                <p><strong>Corrective Action:</strong> {verifyTarget.corrective_action}</p>

                <strong>Evidence Provided:</strong>
                <FilePreview fileUrl={verifyTarget.evidence_url} />
              </div>
            </div>
          )}
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowVerifyModal(false)}>Cancel</Button>
          <Button variant="success" onClick={confirmVerification}>
            <FaCheckDouble /> Confirm & Close NC
          </Button>
        </Modal.Footer>
      </Modal>

      {/* NC Modal */}
      <Modal show={showNCModal} onHide={() => setShowNCModal(false)} centered>
        <Modal.Header closeButton className="bg-danger text-white">
          <Modal.Title>Raise Non-Conformance</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          <p className="text-muted mb-3">
            <strong>Instrument:</strong> {selectedInstrumentName}
          </p>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Describe the Issue</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={ncDescription}
              onChange={(e) => setNcDescription(e.target.value)}
              placeholder="Describe results..."
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="fw-bold">Picture Evidence</Form.Label>
            <Form.Control
              type="file"
              accept="image/*"
              onChange={(e: any) => e.target.files?.[0] && handleNCPictureUpload(e.target.files[0])}
              disabled={isUploading}
            />
            {issueImageUrl && (
              <div className="mt-2 border rounded overflow-hidden">
                <img src={issueImageUrl} alt="Evidence" className="img-fluid w-100" />
              </div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNCModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleRaiseNC} disabled={isUploading}>
            <FaExclamationTriangle className="me-2" /> Raise NC
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default CalibrationTab;
