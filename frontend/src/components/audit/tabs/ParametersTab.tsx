import { useEffect, useState } from 'react';
import { Table, Form, Button, Row, Col, Modal } from 'react-bootstrap';
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

const ParametersTab = ({ auditId, initialData, ncs, readOnly, onRefresh }: Props) => {
  const [params, setParams] = useState(initialData || []);

  // New Entry State
  const [newName, setNewName] = useState('');
  const [newSpec, setNewSpec] = useState('');
  const [valA, setValA] = useState('');
  const [valB, setValB] = useState('');
  const [valC, setValC] = useState('');
  const [remarks, setRemarks] = useState('');

  // NC Modal State
  const [showNCModal, setShowNCModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [thresholdTarget, setThresholdTarget] = useState<any>(null);
  const [ncDescription, setNcDescription] = useState('');
  const [issueImageUrl, setIssueImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedParameterId, setSelectedParameterId] = useState<string>('');
  const [selectedParameterName, setSelectedParameterName] = useState<string>('');

  // Verification State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<any>(null);

  const getNC = (paramId: string) => {
    return ncs?.find(nc => nc.question_id === paramId && nc.status !== 'Closed');
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
    // Only set from initialData if we don't have any or if props changed significantly
    if (initialData && initialData.length > 0) {
      setParams(initialData);
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
        question_id: selectedParameterId || `param_${selectedParameterName}`,
        issue_description: `Parameter: ${selectedParameterName} - ${ncDescription}`,
        issue_image_url: issueImageUrl
      });
      setShowNCModal(false);
      setNcDescription('');
      setIssueImageUrl(null);
      toast.success("NC Raised successfully!");
      onRefresh(); // Refresh parent to see the new NC in Actions column
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to raise NC");
    }
  };

  const handleSave = async (item: any) => {
    if (readOnly) return;
    try {
      const res = await api.post('/answers/parameters', {
        ...item,
        audit_id: auditId
      });

      const savedData = res.data;

      // Update local state with the returned ID and data
      setParams((prev: any[]) =>
        prev.map(p => {
          const isMatch = (p.parameter_id && p.parameter_id === savedData.parameter_id) ||
            (!p.parameter_id && p.parameter_name === item.parameter_name);
          return isMatch ? { ...p, ...savedData } : p;
        })
      );

      toast.success("Saved");
      // REMOVED onRefresh() here to prevent UI flickering on every blur.
      return savedData;
    } catch (err) {
      console.error("Failed to save parameter:", err);
      toast.error("Failed to save");
      throw err;
    }
  };

  const handleAddParam = async () => {
    if (readOnly) return;
    if (!newName) return;

    try {
      const res = await api.post('/answers/parameters', {
        audit_id: auditId,
        parameter_name: newName,
        spec_limit: newSpec,
        shift_a_value: valA,
        shift_b_value: valB,
        shift_c_value: valC,
        remarks: remarks
      });

      setNewName('');
      setNewSpec('');
      setValA('');
      setValB('');
      setValC('');
      setRemarks('');
      toast.success("Parameter added");
      onRefresh();

      if (remarks === 'NOT OK') {
        setSelectedParameterId(res.data.parameter_id);
        setSelectedParameterName(newName);
        setShowNCModal(true);
      }
    } catch (err) {
      toast.error("Failed to add record");
    }
  };

  const handleDelete = async (id: string) => {
    if (readOnly) return;
    if (!window.confirm("Delete this parameter record?")) return;
    try {
      await api.delete(`/answers/parameters/${id}`);
      toast.success("Deleted");
      onRefresh();
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

  const handleRemarksChange = async (item: any, value: string) => {
    // Update local state immediately for UI responsiveness
    setParams((prev: any[]) =>
      prev.map(p => p.parameter_id === item.parameter_id ||
        (!p.parameter_id && p.parameter_name === item.parameter_name)
        ? { ...p, remarks: value } : p)
    );

    if (value === 'NOT OK' && !readOnly) {
      try {
        let currentItem = { ...item, remarks: value };
        if (!currentItem.parameter_id) {
          // Force save to get valid UUID before raising NC
          const saved = await handleSave(currentItem);
          currentItem.parameter_id = saved.parameter_id;
        } else {
          await handleSave(currentItem);
        }

        setSelectedParameterId(currentItem.parameter_id);
        setSelectedParameterName(currentItem.parameter_name);
        setShowNCModal(true);
      } catch (err) {
        console.error("Failed to prepare NC:", err);
      }
    } else if (!readOnly) {
      handleSave({ ...item, remarks: value });
    }
  };

  const checkThresholdAndPromptNC = async (item: any, actualKey: string, targetKey: string) => {
    const actualVal = item[actualKey];
    const targetVal = item[targetKey];
    const actual = parseFloat(actualVal);
    const target = parseFloat(targetVal);

    if (!isNaN(actual) && !isNaN(target) && actual < target) {
      setThresholdTarget({
        item,
        actual,
        target,
        actualKey,
        targetKey
      });
      setShowThresholdModal(true);
    }
  };

  const handleConfirmThresholdNC = async () => {
    if (!thresholdTarget) return;
    const { item } = thresholdTarget;
    let currentItem = { ...item };
    try {
      if (!currentItem.parameter_id) {
        const saved = await handleSave(currentItem);
        currentItem = { ...currentItem, ...saved };
      }
      setSelectedParameterId(currentItem.parameter_id);
      setSelectedParameterName(currentItem.parameter_name || "Parameter");
      setShowThresholdModal(false);
      setShowNCModal(true);
    } catch (err) {
      console.error("Failed to trigger NC from threshold:", err);
    }
  };

  return (
    <div className="mb-4">
      <h5 className="text-primary fw-bold border-bottom pb-2 mb-3">
        Process & Product Parameters
      </h5>

      <Table bordered hover responsive className="align-middle text-center shadow-sm">
        <thead className="table-light">
          <tr>
            <th style={{ width: '20%', textAlign: 'left' }}>Parameter Name</th>
            <th style={{ width: '15%' }}>Specification</th>
            <th style={{ width: '12%' }}>Shift A</th>
            <th style={{ width: '12%' }}>Shift B</th>
            <th style={{ width: '12%' }}>Shift C</th>
            <th style={{ width: '15%' }}>Remarks</th>
            <th style={{ width: '50px' }}></th>
          </tr>
        </thead>
        <tbody>
          {params.map((row: any, idx: number) => {
            const activeNC = getNC(row.parameter_id);
            return (
              <tr key={idx} className={activeNC ? "table-warning" : ""}>
                <td>
                  <Form.Control
                    size="sm"
                    plaintext={readOnly}
                    readOnly={readOnly}
                    value={row.parameter_name || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setParams(params.map((p, i) => i === idx ? { ...p, parameter_name: val } : p));
                    }}
                    onBlur={() => handleSave(row)}
                  />
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    disabled={readOnly}
                    value={row.spec_limit || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setParams(params.map((p, i) => i === idx ? { ...p, spec_limit: val } : p));
                    }}
                    onBlur={() => handleSave(row)}
                  />
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    disabled={readOnly}
                    value={row.shift_a_value || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setParams(params.map((p, i) => i === idx ? { ...p, shift_a_value: val } : p));
                    }}
                    onBlur={(e) => {
                      handleSave({ ...row, shift_a_value: e.target.value });
                      checkThresholdAndPromptNC({ ...row, shift_a_value: e.target.value }, 'shift_a_value', 'spec_limit');
                    }}
                  />
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    disabled={readOnly}
                    value={row.shift_b_value || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setParams(params.map((p, i) => i === idx ? { ...p, shift_b_value: val } : p));
                    }}
                    onBlur={(e) => {
                      handleSave({ ...row, shift_b_value: e.target.value });
                      checkThresholdAndPromptNC({ ...row, shift_b_value: e.target.value }, 'shift_b_value', 'spec_limit');
                    }}
                  />
                </td>
                <td>
                  <Form.Control
                    size="sm"
                    disabled={readOnly}
                    value={row.shift_c_value || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setParams(params.map((p, i) => i === idx ? { ...p, shift_c_value: val } : p));
                    }}
                    onBlur={(e) => {
                      handleSave({ ...row, shift_c_value: e.target.value });
                      checkThresholdAndPromptNC({ ...row, shift_c_value: e.target.value }, 'shift_c_value', 'spec_limit');
                    }}
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
                      onClick={() => handleDelete(row.parameter_id)}
                      disabled={readOnly}
                    >
                      <FaTrash />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}

          {params.length === 0 && (
            <tr>
              <td colSpan={7} className="text-center text-muted p-4">
                No parameters logged.
              </td>
            </tr>
          )}
        </tbody>
      </Table>

      {!readOnly && (
        <div className="bg-light p-3 rounded border mt-3 mb-5">
          <h6 className="fw-bold mb-3 text-primary">Log New Parameter</h6>
          <Row className="g-2 mb-2">
            <Col md={3}>
              <Form.Control
                placeholder="Param Name"
                value={newName}
                onChange={e => setNewName(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Control
                placeholder="Spec (e.g. 4-6%)"
                value={newSpec}
                onChange={e => setNewSpec(e.target.value)}
              />
            </Col>
            <Col md={6}>
              <Form.Select
                value={remarks}
                onChange={e => setRemarks(e.target.value)}
              >
                <option value="">Select...</option>
                <option value="OK">OK</option>
                <option value="NOT OK">NOT OK</option>
              </Form.Select>
            </Col>
          </Row>
          <Row className="g-2">
            <Col md={3}>
              <Form.Control
                placeholder="Shift A Value"
                value={valA}
                onChange={e => setValA(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Control
                placeholder="Shift B Value"
                value={valB}
                onChange={e => setValB(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Form.Control
                placeholder="Shift C Value"
                value={valC}
                onChange={e => setValC(e.target.value)}
              />
            </Col>
            <Col md={3}>
              <Button
                variant="primary"
                className="w-100"
                onClick={handleAddParam}
              >
                <FaPlus className="me-1" /> Save Row
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
            <strong>Parameter:</strong> {selectedParameterName}
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

      {/* Threshold Alert Modal */}
      <Modal show={showThresholdModal} onHide={() => setShowThresholdModal(false)} centered>
        <Modal.Header closeButton className="bg-warning text-dark">
          <Modal.Title>
            <FaExclamationTriangle className="me-2" />
            Process Limit Alert
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          <div className="mb-3">
            <div className="small text-muted text-uppercase fw-bold">Limit Not Met</div>
            <h5 className="mb-0 text-dark">
              Actual reading (<strong>{thresholdTarget?.actual}</strong>) is below specification (<strong>{thresholdTarget?.target}</strong>)
            </h5>
          </div>
          <p className="mb-0">
            This variation may require documentation. Would you like to raise a <strong>Non-Conformance (NC)</strong> now?
          </p>
        </Modal.Body>
        <Modal.Footer className="justify-content-center border-0 pb-4">
          <Button variant="outline-secondary" className="px-4" onClick={() => setShowThresholdModal(false)}>
            Not Now
          </Button>
          <Button variant="warning" className="px-4 fw-bold" onClick={handleConfirmThresholdNC}>
            Yes, Raise NC
          </Button>
        </Modal.Footer>
      </Modal>
    </div>
  );
};

export default ParametersTab;
