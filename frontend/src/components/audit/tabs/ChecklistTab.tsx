import { useEffect, useState } from 'react';
import { Table, Form, Button, Badge, Modal, ButtonGroup, Card } from 'react-bootstrap';
import { FaPaperclip, FaExclamationTriangle, FaCheckDouble } from 'react-icons/fa';
import api from '../../../api/axios';
import FilePreview from '../../common/FilePreview';
import { toast } from 'react-toastify';

interface Props {
  auditId: string;
  initialData: any[];
  ncs: any[];
  onRefresh: () => void;
  readOnly?: boolean;
  scoringMode?: boolean;
  sectionFilter?: (sectionName: string) => boolean; // Optional filter
}

const ChecklistTab = ({ auditId, initialData, ncs, onRefresh, readOnly, scoringMode, sectionFilter }: Props) => {
  const [answers, setAnswers] = useState(initialData || []);


  // NC Raising State
  const [showNCModal, setShowNCModal] = useState(false);
  const [ncDescription, setNcDescription] = useState('');
  const [issueImageUrl, setIssueImageUrl] = useState<string | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedQuestionId, setSelectedQuestionId] = useState<string | null>(null);

  // Verification State
  const [showVerifyModal, setShowVerifyModal] = useState(false);
  const [verifyTarget, setVerifyTarget] = useState<any>(null); // Stores the NC being verified

  useEffect(() => {
    setAnswers(initialData || []);
  }, [initialData]);

  const getNCForQuestion = (qId: string) => {
    return ncs?.find(nc => nc.question_id === qId && nc.status !== 'Closed');
  };

  const handleSaveObservation = async (questionId: string, observation: string, fileUrl: string | null, l1Value?: string) => {
    if (readOnly) return;
    try {
      await api.post(`/answers/checklist`, {
        audit_id: auditId,
        question_id: questionId,
        l1_observation: observation, // Ensure these names match backend
        l1_value: l1Value,
        file_url: fileUrl
      });
    } catch (err: any) {
      console.error("Save failed", err);
      toast.error(`Failed to save answer: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleFileUpload = async (questionId: string, file: File) => {
    if (readOnly) return;
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Remove manual header to allow browser boundary generation
      const uploadRes = await api.post('/upload', formData);
      const realFileUrl = uploadRes.data.url;

      const currentObs = answers.find((a: any) => a.question_id === questionId)?.l1_observation || '';
      await handleSaveObservation(questionId, currentObs, realFileUrl);

      setAnswers((prev: any) => prev.map((a: any) => a.question_id === questionId ? { ...a, file_url: realFileUrl } : a));
    } catch (err: any) {
      console.error(err);
      toast.error(`Upload failed: ${err.response?.data?.error || err.message}`);
    }
  };

  const handleRaiseNC = async () => {
    if (!selectedQuestionId || !ncDescription) return;
    try {
      await api.post(`/nc`, {
        audit_id: auditId,
        question_id: selectedQuestionId,
        issue_description: ncDescription,
        issue_image_url: issueImageUrl
      });
      setShowNCModal(false); setNcDescription(''); setIssueImageUrl(null); onRefresh(); toast.success("NC Raised!");
    } catch (err: any) { toast.error(err.response?.data?.error || "Failed to raise NC"); }
  };

  const handleNCPictureUpload = async (file: File) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // Removed manual header to trigger automatic boundary generation
      const res = await api.post('/upload', formData); // Axios sets correct multipart header with boundary automatically
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

  // --- NEW: Open Verification Modal ---
  const openVerification = (nc: any) => {
    setVerifyTarget(nc);
    setShowVerifyModal(true);
  };

  const confirmVerification = async () => {
    if (!verifyTarget) return;
    try {
      await api.post(`/nc/${verifyTarget.nc_id}/verify`);
      setShowVerifyModal(false);
      onRefresh(); // Reloads data to show status closed
    } catch (err) { toast.error("Verification failed"); }
  };

  // --- SCORING ---
  const handleScore = async (questionId: string, score: number) => {
    try {
      setAnswers((prev: any) => prev.map((a: any) => a.question_id === questionId ? { ...a, l2_score: score } : a));
      // Fixed API call: Use PUT and correct payload structure
      await api.put(`/audits/${auditId}/score`, {
        question_id: questionId,
        l2_score: score
      });
    } catch (err) {
      console.error(err);
      toast.error("Scoring failed");
    }
  };

  const sections = answers.reduce((acc: any, curr: any) => {
    const sec = curr.section_name;
    if (!acc[sec]) acc[sec] = [];
    acc[sec].push(curr);
    return acc;
  }, {});

  return (
    <>
      {Object.keys(sections)
        .filter(section => sectionFilter ? sectionFilter(section) : true)
        .map(section => {
          // Determine if this section is part of a Dock Audit based on input_type of first question
          const isDockAudit = sections[section][0]?.input_type === 'dock_audit';

          // Custom headers for Dock Audit sections
          let qHeader = "Question";
          let obsHeader = "Observation (L1)";
          let scoreHeader = "Score / Status";

          if (isDockAudit) {
            scoreHeader = "NC/OK";
            if (section.includes("RELEVANT DOCUMENTS")) {
              qHeader = "DOCUMENT TYPE";
              obsHeader = "Observation";
            } else if (section.includes("DIMENSIONAL")) {
              qHeader = "Specified Visual Parameters";
              obsHeader = "Comments";
            } else if (section.includes("Product Audit")) {
              qHeader = "Operation";
              obsHeader = "Observation";
              // We need a custom header for the "Audit done on" column, so we'll adjust the table structure below
            } else {
              qHeader = "Specified Visual Parameters";
              obsHeader = "Observation";
            }
          }

          const isProductAudit = section.includes("Product Audit");

          return (
            <div key={section} className="mb-5">
              <h5 className="text-primary fw-bold border-bottom pb-2 mb-3">{section}</h5>
              <Table hover className="align-middle shadow-sm custom-table">
                <thead className="bg-light text-secondary">
                  <tr>
                    <th style={{ width: '5%' }} className="text-center">Sr No</th>
                    <th style={{ width: '35%' }} className="ps-4">{qHeader}</th>

                    {isProductAudit && (
                      <th style={{ width: '25%' }}>Audit done on</th>
                    )}

                    <th style={{ width: isProductAudit ? '35%' : (isDockAudit ? '35%' : '35%') }}>{obsHeader}</th>

                    {/* Hide Score column for Product Audit as per image? The image shows "Observation" as last col. 
                      But usually we need score/NC. The image DOES show "Observation" as the last column.
                      Let's assume NO score column for this specific section based on the image provided in user request, 
                      BUT standard practice implies some result. 
                      However, looking at the image provided (Step 0), the columns are: Sl No | Operation | Audit done on | Observation.
                      There is NO score/status column. So we hide it.
                  */}
                    {!isProductAudit && (
                      <th style={{ width: '20%', textAlign: 'center' }}>{scoreHeader}</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sections[section].map((item: any) => {
                    const activeNC = getNCForQuestion(item.question_id);
                    // Determine Row Style
                    const rowClass = activeNC ? "table-warning" : "";
                    const isDockItem = item.input_type === 'dock_audit';

                    return (
                      <tr key={item.question_id} className={rowClass}>
                        <td className="text-center text-muted">{item.question_order}</td>
                        <td className="ps-4 py-3">
                          <div className="fw-bold text-dark mb-1">{item.question_text}</div>
                        </td>

                        {/* NEW: Audit Done On Column */}
                        {isProductAudit && (
                          <td className="py-3">
                            <Form.Control
                              type="text"
                              className="bg-light border-0 shadow-sm"
                              value={item.l1_value || ''} // Uses the NEW column
                              disabled={readOnly}
                              placeholder="Type here..."
                              onChange={(e) => {
                                const val = e.target.value;
                                setAnswers((prev: any) => prev.map((a: any) => a.question_id === item.question_id ? { ...a, l1_value: val } : a));
                              }}
                              onBlur={(e) => {
                                // We reuse handleSaveObservation but we need to update api to accept l1_value
                                // Since handleSaveObservation is rigid, we'll make a direct API call or update it.
                                // Let's inline the save for now or update handleSaveObservation.
                                // Updating handleSaveObservation to be more generic is better, but for now let's just call API directly here or modify the function.
                                // Actually, I should have updated handleSaveObservation in the previous steps if I wanted to reuse it.
                                // I will modify the helper function below this block.
                                handleSaveObservation(item.question_id, item.l1_observation, item.file_url, e.target.value)
                              }}
                            />
                          </td>
                        )}

                        <td className="py-3">
                          <div className="d-flex flex-column gap-2">
                            <Form.Control
                              as="textarea"
                              rows={2}
                              className="bg-light border-0 shadow-sm"
                              value={item.l1_observation || ''}
                              disabled={readOnly}
                              placeholder={readOnly ? "No observation recorded." : "Type observation here..."}
                              onChange={(e) => {
                                const val = e.target.value;
                                setAnswers((prev: any) => prev.map((a: any) => a.question_id === item.question_id ? { ...a, l1_observation: val } : a));
                              }}
                              onBlur={(e) => handleSaveObservation(item.question_id, e.target.value, item.file_url, item.l1_value)}
                            />
                            <div className="d-flex justify-content-between align-items-center">
                              {!readOnly && (
                                <div className="position-relative">
                                  <input type="file" id={`file-${item.question_id}`} className="d-none" onChange={(e) => e.target.files && handleFileUpload(item.question_id, e.target.files[0])} />
                                  <label htmlFor={`file-${item.question_id}`} className={`btn btn-sm btn-outline-secondary d-flex align-items-center gap-2 ${item.file_url ? 'active' : ''}`}>
                                    <FaPaperclip /> {item.file_url ? "Replace File" : "Attach Evidence"}
                                  </label>
                                </div>
                              )}
                              {item.file_url && <FilePreview fileUrl={item.file_url} />}
                            </div>
                          </div>
                        </td>

                        {/* Hide Score Column for Product Audit */}
                        {!isProductAudit && (
                          <td className="text-center align-middle">
                            {isDockItem ? (
                              /* --- DOCK AUDIT: OK/NC CHECKBOXES --- */
                              <div className="d-flex justify-content-center gap-3">
                                <Form.Check
                                  type="checkbox"
                                  label="NC"
                                  className="text-danger fw-bold"
                                  disabled={readOnly}
                                  checked={item.l2_score === 0} // 0 = NC
                                  onChange={() => {
                                    handleScore(item.question_id, 0);
                                    if (!readOnly) { setSelectedQuestionId(item.question_id); setShowNCModal(true); }
                                  }}
                                />
                                <Form.Check
                                  type="checkbox"
                                  label="OK"
                                  className="text-success fw-bold"
                                  disabled={readOnly}
                                  checked={item.l2_score === 2} // 2 = OK
                                  onChange={() => handleScore(item.question_id, 2)}
                                />
                              </div>
                            ) : (
                              /* --- STANDARD SCORING --- */
                              scoringMode ? (
                                <ButtonGroup className="shadow-sm">
                                  {[0, 1, 2, 3].map(score => (
                                    <Button
                                      key={score}
                                      variant={item.l2_score === score ? (score === 0 ? "danger" : score === 1 ? "warning" : score === 2 ? "success" : "secondary") : "outline-light text-dark border"}
                                      className="fw-bold"
                                      onClick={() => handleScore(item.question_id, score)}
                                    >
                                      {score === 3 ? "NA" : score}
                                    </Button>
                                  ))}
                                </ButtonGroup>
                              ) : (
                                <div className="d-flex flex-column align-items-center gap-2">
                                  {/* SHOW SCORE IF IT EXISTS */}
                                  {item.l2_score !== null && item.l2_score !== undefined && (
                                    <Badge bg={item.l2_score === 2 ? "success" : item.l2_score === 1 ? "warning" : item.l2_score === 3 ? "secondary" : "danger"} className="fs-6 px-3 py-2">
                                      L2 Score: {item.l2_score === 3 ? "NA" : item.l2_score}
                                    </Badge>
                                  )}

                                  {/* NC ACTIONS */}
                                  {activeNC ? (
                                    activeNC.status === 'Pending_Verification' ? (
                                      <Button variant="success" size="sm" onClick={() => openVerification(activeNC)}>
                                        <FaCheckDouble /> Verify Fix
                                      </Button>
                                    ) : <Badge bg="danger" className="p-2"><FaExclamationTriangle /> NC OPEN</Badge>
                                  ) : (
                                    // Only show Raise NC if NO Score and NOT ReadOnly (or if it's L1 working)
                                    (!readOnly && item.l2_score === null) && (
                                      <Button variant="outline-danger" size="sm" className="border-0" onClick={() => { setSelectedQuestionId(item.question_id); setShowNCModal(true); }}>
                                        <FaExclamationTriangle /> Raise NC
                                      </Button>
                                    )
                                  )}
                                </div>
                              ))}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </Table>
            </div>
          );
        })}

      {/* 1. Raise NC Modal */}
      <Modal show={showNCModal} onHide={() => setShowNCModal(false)} centered>
        <Modal.Header closeButton className="bg-danger text-white"><Modal.Title>Raise Non-Conformance</Modal.Title></Modal.Header>
        <Modal.Body>
          <Form.Group className="mb-3">
            <Form.Label className="fw-bold">Describe the Issue</Form.Label>
            <Form.Control as="textarea" rows={4} value={ncDescription} onChange={(e) => setNcDescription(e.target.value)} placeholder="Describe the findings in detail..." />
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
          <Button variant="danger" onClick={handleRaiseNC} disabled={isUploading}>Confirm</Button>
        </Modal.Footer>
      </Modal>

      {/* 2. Verification Modal (THE NEW PART) */}
      <Modal show={showVerifyModal} onHide={() => setShowVerifyModal(false)} size="lg" centered>
        <Modal.Header closeButton className="bg-success text-white">
          <Modal.Title>Verify Corrective Action</Modal.Title>
        </Modal.Header>
        <Modal.Body>
          {verifyTarget && (
            <div className="d-flex flex-column gap-3">
              <Card className="bg-light border-0">
                <Card.Body>
                  <div className="mb-2"><strong className="text-danger">Issue:</strong> {verifyTarget.issue_description}</div>
                  {verifyTarget.issue_image_url && (
                    <div style={{ maxWidth: '300px' }}>
                      <FilePreview fileUrl={verifyTarget.issue_image_url} />
                    </div>
                  )}
                </Card.Body>
              </Card>

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
    </>
  );
};

export default ChecklistTab;