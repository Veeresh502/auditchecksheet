import { useEffect, useState } from 'react';
import { Table, Form, Modal, Button } from 'react-bootstrap';
import { FaExclamationTriangle, FaTrash, FaCheckDouble } from 'react-icons/fa';
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

const ObjectivesTab = ({ auditId, initialData, ncs, readOnly, onRefresh }: Props) => {
  const [objectives, setObjectives] = useState(initialData || []);

  // NC Modal State
  const [showNCModal, setShowNCModal] = useState(false);
  const [showThresholdModal, setShowThresholdModal] = useState(false);
  const [thresholdTarget, setThresholdTarget] = useState<any>(null);
  const [ncDescription, setNcDescription] = useState('');
  const [issueImageUrl, setIssueImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedObjectiveId, setSelectedObjectiveId] = useState<string | null>(null);
  const [selectedObjectiveName, setSelectedObjectiveName] = useState<string>('');

  // Verification State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<any>(null);

  const getNC = (objId: string) => {
    return ncs?.find(nc => nc.question_id === objId && nc.status !== 'Closed');
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
    // Only set objectives from initialData if we don't have any yet or if clearly different
    // This prevents "flickering" when parent re-fetches while user is typing
    if (initialData && initialData.length > 0) {
      setObjectives(initialData);
    }
  }, [initialData]);

  const handleSave = async (updatedItem: any) => {
    try {
      if (!updatedItem.parameter_name) return;

      const res = await api.post(`/answers/objectives`, {
        audit_id: auditId,
        ...updatedItem
      });

      const savedData = res.data;

      // Update local state with the returned ID and data
      setObjectives((prev: any[]) =>
        prev.map(obj => {
          const isMatch = (obj.objective_id && obj.objective_id === savedData.objective_id) ||
            (!obj.objective_id && obj.objective_type === updatedItem.objective_type && obj.parameter_name === updatedItem.parameter_name);
          return isMatch ? { ...obj, ...savedData } : obj;
        })
      );

      toast.success("Saved");
      // REMOVED onRefresh() here to prevent UI flickering on every blur.
      // The local state update above is sufficient and much smoother.
      return savedData; // Return data for potential chain actions
    } catch (err: any) {
      const errorDetail = err.response?.data?.error || err.message || "Unknown server error";
      console.error("Failed to save objective:", err);
      toast.error(`Save Failed: ${errorDetail}`);
      throw err;
    }
  };

  const handleDelete = async (objectiveId: string) => {
    if (readOnly) return;
    if (!window.confirm("Are you sure you want to delete this row?")) return;

    try {
      await api.delete(`/answers/objectives/${objectiveId}`);
      toast.success("Deleted");
      onRefresh(); // Trigger parent refresh
    } catch (err) {
      toast.error("Failed to delete");
    }
  };

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
      const msg = err.response?.data?.error || err.message || "Unknown upload error";
      toast.error(`Upload failed: ${msg}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleRaiseNC = async () => {
    if (!selectedObjectiveId || !ncDescription) {
      toast.error("Please provide NC description");
      return;
    }
    try {
      await api.post(`/nc`, {
        audit_id: auditId,
        question_id: selectedObjectiveId,
        issue_description: `Objective: ${selectedObjectiveName} - ${ncDescription}`,
        issue_image_url: issueImageUrl
      });
      setShowNCModal(false);
      setNcDescription('');
      setIssueImageUrl(null);
      setSelectedObjectiveId(null);
      setSelectedObjectiveName('');
      toast.success("NC Raised for objective!");
      onRefresh(); // Trigger refresh to update parent and visibility in Actions column
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to raise NC");
    }
  };

  const addNewRow = (type: string) => {
    const newItem = {
      objective_type: type,
      parameter_name: '',
      sample_size: '',
      target_value: '',
      actual_value: '',
      tool_target: '',
      tool_actual: '',
      machine_target: '',
      machine_actual: '',
      remarks: ''
    };
    setObjectives([...objectives, newItem]);
  };

  const handleRemarksChange = async (item: any, value: string) => {
    // Update local state immediately for UI responsiveness
    setObjectives((prev: any[]) =>
      prev.map(obj =>
        (obj.objective_id === item.objective_id) ||
          (obj.objective_type === item.objective_type && obj.parameter_name === item.parameter_name)
          ? { ...obj, remarks: value }
          : obj
      )
    );

    // If NOT OK is selected, we MUST ensure the row is saved first to get a real ID
    if (value === 'NOT OK' && !readOnly) {
      try {
        let currentItem = { ...item, remarks: value };
        if (!currentItem.objective_id) {
          // New row: Force a save to get the UUID
          const saved = await handleSave(currentItem);
          currentItem.objective_id = saved.objective_id;
        } else {
          // Existing row: Just save the remarks
          await handleSave(currentItem);
        }

        setSelectedObjectiveId(currentItem.objective_id);
        setSelectedObjectiveName(currentItem.parameter_name || 'Unnamed Objective');
        setShowNCModal(true);
      } catch (err) {
        console.error("Failed to prepare NC:", err);
      }
    } else if (!readOnly) {
      // Just save the remarks for 'OK' or empty
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
      if (!currentItem.objective_id) {
        const saved = await handleSave(currentItem);
        currentItem = { ...currentItem, ...saved };
      }
      setSelectedObjectiveId(currentItem.objective_id);
      setSelectedObjectiveName(currentItem.parameter_name || "Objective");
      setShowThresholdModal(false);
      setShowNCModal(true);
    } catch (err) {
      console.error("Failed to trigger NC from threshold:", err);
    }
  };

  const renderTable = (title: string, type: string, headers: string[], rows: any[]) => (
    <div className="mb-5">
      <div className="d-flex justify-content-between align-items-center mb-3">
        <h6 className="text-dark fw-bold m-0 text-uppercase" style={{ letterSpacing: '1px', borderLeft: '4px solid #0d6efd', paddingLeft: '10px' }}>
          {title}
        </h6>
        {!readOnly && (
          <button className="btn btn-sm btn-outline-primary" onClick={() => addNewRow(type)}>
            <i className="bi bi-plus-lg me-1"></i> Add Row
          </button>
        )}
      </div>
      <Table bordered hover responsive className="align-middle shadow-sm">
        <thead className="table-light">
          <tr>
            {headers.map((h, i) => <th key={i} className="small text-muted">{h}</th>)}
            <th className="small text-muted">ACTIONS</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((item: any, index: number) => {
            const activeNC = getNC(item.objective_id);
            return (
              <tr key={index} className={activeNC ? "table-warning" : ""}>
                {type === 'product_characteristic' && <td>{index + 1}</td>}
                <td>
                  <Form.Control
                    size="sm"
                    disabled={readOnly}
                    type="text"
                    placeholder="Characteristic name..."
                    value={item.parameter_name || ''}
                    onChange={(e) => {
                      const val = e.target.value;
                      setObjectives((prev: any[]) =>
                        prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, parameter_name: val } : obj)
                      );
                    }}
                    onBlur={(e) => handleSave({ ...item, parameter_name: e.target.value })}
                  />
                </td>
                {type === 'product_characteristic' && (
                  <td>
                    <Form.Control
                      size="sm"
                      disabled={readOnly}
                      type="text"
                      value={item.sample_size || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setObjectives((prev: any[]) =>
                          prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, sample_size: val } : obj)
                        );
                      }}
                      onBlur={(e) => handleSave({ ...item, sample_size: e.target.value })}
                    />
                  </td>
                )}
                {type !== 'maintenance' && (
                  <>
                    <td>
                      <Form.Control
                        size="sm"
                        disabled={readOnly}
                        type="text"
                        className="text-primary fw-bold"
                        value={item.target_value || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setObjectives((prev: any[]) =>
                            prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, target_value: val } : obj)
                          );
                        }}
                        onBlur={(e) => handleSave({ ...item, target_value: e.target.value })}
                      />
                    </td>
                    <td>
                      <Form.Control
                        size="sm"
                        disabled={readOnly}
                        type="text"
                        value={item.actual_value || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setObjectives((prev: any[]) =>
                            prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, actual_value: val } : obj)
                          );
                        }}
                        onBlur={(e) => {
                          handleSave({ ...item, actual_value: e.target.value });
                          checkThresholdAndPromptNC({ ...item, actual_value: e.target.value }, 'actual_value', 'target_value');
                        }}
                      />
                    </td>
                  </>
                )}
                {type === 'maintenance' && (
                  <>
                    <td>
                      <Form.Control
                        size="sm"
                        disabled={readOnly}
                        type="text"
                        className="text-primary fw-bold text-center"
                        value={item.tool_target || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setObjectives((prev: any[]) =>
                            prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, tool_target: val } : obj)
                          );
                        }}
                        onBlur={(e) => handleSave({ ...item, tool_target: e.target.value })}
                      />
                    </td>
                    <td>
                      <Form.Control
                        size="sm"
                        disabled={readOnly}
                        type="text"
                        className="text-center"
                        value={item.tool_actual || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setObjectives((prev: any[]) =>
                            prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, tool_actual: val } : obj)
                          );
                        }}
                        onBlur={(e) => {
                          handleSave({ ...item, tool_actual: e.target.value });
                          checkThresholdAndPromptNC({ ...item, tool_actual: e.target.value }, 'tool_actual', 'tool_target');
                        }}
                      />
                    </td>
                    <td>
                      <Form.Control
                        size="sm"
                        disabled={readOnly}
                        type="text"
                        className="text-primary fw-bold"
                        value={item.machine_target || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setObjectives((prev: any[]) =>
                            prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, machine_target: val } : obj)
                          );
                        }}
                        onBlur={(e) => handleSave({ ...item, machine_target: e.target.value })}
                      />
                    </td>
                    <td>
                      <Form.Control
                        size="sm"
                        disabled={readOnly}
                        type="text"
                        value={item.machine_actual || ''}
                        onChange={(e) => {
                          const val = e.target.value;
                          setObjectives((prev: any[]) =>
                            prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, machine_actual: val } : obj)
                          );
                        }}
                        onBlur={(e) => {
                          handleSave({ ...item, machine_actual: e.target.value });
                          checkThresholdAndPromptNC({ ...item, machine_actual: e.target.value }, 'machine_actual', 'machine_target');
                        }}
                      />
                    </td>
                  </>
                )}
                <td>
                  <Form.Select
                    size="sm"
                    disabled={readOnly}
                    value={item.remarks || ''}
                    onChange={(e) => handleRemarksChange(item, e.target.value)}
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
                      onClick={() => handleDelete(item.objective_id)}
                      disabled={readOnly || !item.objective_id}
                    >
                      <FaTrash />
                    </Button>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </Table >
    </div >
  );

  const productChars = objectives.filter((o: any) => o.objective_type === 'product_characteristic');
  const productivity = objectives.filter((o: any) => o.objective_type === 'productivity');
  const maintenance = objectives.filter((o: any) => o.objective_type === 'maintenance');
  const quality = objectives.filter((o: any) => o.objective_type === 'quality');

  return (
    <div className="mb-4">
      <div className="d-flex justify-content-between align-items-center border-bottom pb-2 mb-4">
        <h5 className="text-primary fw-bold m-0">MANUFACTURING PROCESS OBJECTIVES Vs ACTUAL</h5>
      </div>

      <div className="alert alert-warning py-2 small mb-4">
        <i className="bi bi-info-circle-fill me-2"></i>
        Please ensure all <strong>Actual</strong> values are recorded accurately from machine logs.
      </div>

      {renderTable("1. Product Characteristics", "product_characteristic",
        ["SL NO", "PRODUCT CHARACTERISTICS", "SAMPLE SIZE", "TARGET", "ACTUAL", "REMARKS"], productChars)}

      {renderTable("2. Productivity Targets", "productivity",
        ["PRODUCTIVITY TARGETS", "TARGET", "ACTUAL", "REMARKS"], productivity)}

      {/* Special Maintenance Table with nested headers */}
      <div className="mb-5">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="text-dark fw-bold m-0 text-uppercase" style={{ letterSpacing: '1px', borderLeft: '4px solid #0d6efd', paddingLeft: '10px' }}>
            3. Maintenance Objectives (From Records)
          </h6>
          {!readOnly && (
            <button className="btn btn-sm btn-outline-primary" onClick={() => addNewRow('maintenance')}>
              <i className="bi bi-plus-lg me-1"></i> Add Row
            </button>
          )}
        </div>
        <Table bordered hover responsive className="align-middle shadow-sm">
          <thead className="table-light">
            <tr>
              <th rowSpan={2} className="small text-muted align-middle">OBJECTIVES</th>
              <th colSpan={2} className="small text-muted text-center">TOOL</th>
              <th colSpan={2} className="small text-muted text-center">MACHINE</th>
              <th rowSpan={2} className="small text-muted align-middle text-center">REMARKS</th>
              <th rowSpan={2} className="small text-muted align-middle text-center">ACTIONS</th>
            </tr>
            <tr>
              <th className="small text-muted text-center">TARGET</th>
              <th className="small text-muted text-center">ACTUAL</th>
              <th className="small text-muted text-center">TARGET</th>
              <th className="small text-muted text-center">ACTUAL</th>
            </tr>
          </thead>
          <tbody>
            {maintenance.map((item: any, index: number) => {
              const activeNC = getNC(item.objective_id);
              return (
                <tr key={index} className={activeNC ? "table-warning" : ""}>
                  <td>
                    <Form.Control
                      size="sm"
                      disabled={readOnly}
                      type="text"
                      placeholder="Objective name..."
                      value={item.parameter_name || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setObjectives((prev: any[]) =>
                          prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, parameter_name: val } : obj)
                        );
                      }}
                      onBlur={(e) => handleSave({ ...item, parameter_name: e.target.value })}
                    />
                  </td>
                  <td>
                    <Form.Control
                      size="sm"
                      disabled={readOnly}
                      type="text"
                      className="text-primary fw-bold text-center"
                      value={item.tool_target || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setObjectives((prev: any[]) =>
                          prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, tool_target: val } : obj)
                        );
                      }}
                      onBlur={(e) => handleSave({ ...item, tool_target: e.target.value })}
                    />
                  </td>
                  <td>
                    <Form.Control
                      size="sm"
                      disabled={readOnly}
                      type="text"
                      className="text-center"
                      value={item.tool_actual || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setObjectives((prev: any[]) =>
                          prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, tool_actual: val } : obj)
                        );
                      }}
                      onBlur={(e) => {
                        handleSave({ ...item, tool_actual: e.target.value });
                        checkThresholdAndPromptNC({ ...item, tool_actual: e.target.value }, 'tool_actual', 'tool_target');
                      }}
                    />
                  </td>
                  <td>
                    <Form.Control
                      size="sm"
                      disabled={readOnly}
                      type="text"
                      className="text-primary fw-bold text-center"
                      value={item.machine_target || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setObjectives((prev: any[]) =>
                          prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, machine_target: val } : obj)
                        );
                      }}
                      onBlur={(e) => handleSave({ ...item, machine_target: e.target.value })}
                    />
                  </td>
                  <td>
                    <Form.Control
                      size="sm"
                      disabled={readOnly}
                      type="text"
                      value={item.machine_actual || ''}
                      onChange={(e) => {
                        const val = e.target.value;
                        setObjectives((prev: any[]) =>
                          prev.map((obj, idx) => idx === objectives.indexOf(item) ? { ...obj, machine_actual: val } : obj)
                        );
                      }}
                      onBlur={(e) => {
                        handleSave({ ...item, machine_actual: e.target.value });
                        checkThresholdAndPromptNC({ ...item, machine_actual: e.target.value }, 'machine_actual', 'machine_target');
                      }}
                    />
                  </td>
                  <td>
                    <Form.Select
                      size="sm"
                      disabled={readOnly}
                      value={item.remarks || ''}
                      onChange={(e) => handleRemarksChange(item, e.target.value)}
                      onBlur={() => handleSave({ ...item, remarks: item.remarks })}
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
                        onClick={() => handleDelete(item.objective_id)}
                        disabled={readOnly || !item.objective_id}
                      >
                        <FaTrash />
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      </div >

      {
        renderTable("4. Quality Targets PPM", "quality",
          ["QUALITY TARGETS", "TARGET", "ACTUAL", "REMARKS"], quality)
      }

      {
        objectives.length === 0 && (
          <div className="text-center p-5 bg-light rounded border border-dashed">
            <p className="text-muted mb-0">No objectives defined for this audit. Use "Add Row" to start.</p>
          </div>
        )
      }

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
            <strong>Objective:</strong> {selectedObjectiveName}
          </p>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Describe the Issue</Form.Label>
            <Form.Control
              as="textarea"
              rows={4}
              value={ncDescription}
              onChange={(e) => setNcDescription(e.target.value)}
              placeholder="Describe the findings in detail..."
            />
          </Form.Group>
          <Form.Group>
            <Form.Label className="fw-bold">Attach Evidence Picture</Form.Label>
            <Form.Control
              type="file"
              accept="image/*"
              onChange={(e: any) => e.target.files?.[0] && handleNCPictureUpload(e.target.files[0])}
              disabled={isUploading}
            />
            {isUploading && <div className="small text-muted mt-1">Uploading...</div>}
            {issueImageUrl && (
              <div className="mt-2 border rounded overflow-hidden" style={{ maxHeight: '150px' }}>
                <img src={issueImageUrl} alt="Evidence" className="img-fluid w-100" style={{ objectFit: 'cover' }} />
              </div>
            )}
          </Form.Group>
        </Modal.Body>
        <Modal.Footer>
          <Button variant="secondary" onClick={() => setShowNCModal(false)}>Cancel</Button>
          <Button variant="danger" onClick={handleRaiseNC} disabled={isUploading}>
            <FaExclamationTriangle className="me-2" />
            Confirm NC
          </Button>
        </Modal.Footer>
      </Modal>

      {/* Threshold Alert Modal */}
      <Modal show={showThresholdModal} onHide={() => setShowThresholdModal(false)} centered>
        <Modal.Header closeButton className="bg-warning text-dark">
          <Modal.Title>
            <FaExclamationTriangle className="me-2" />
            Performance Alert
          </Modal.Title>
        </Modal.Header>
        <Modal.Body className="text-center py-4">
          <div className="mb-3">
            <div className="small text-muted text-uppercase fw-bold">Threshold Not Met</div>
            <h5 className="mb-0 text-dark">
              Actual value (<strong>{thresholdTarget?.actual}</strong>) is lower than target (<strong>{thresholdTarget?.target}</strong>)
            </h5>
          </div>
          <p className="mb-0">
            This performance gap may require documentation. Would you like to raise a <strong>Non-Conformance (NC)</strong> now?
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
    </div >
  );
};

export default ObjectivesTab;