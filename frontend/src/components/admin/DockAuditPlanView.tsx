import { Table } from 'react-bootstrap';

// Dummy data to mimic the Excel file (In real app, fetch from API)
const DUMMY_PLAN = [
  { product: 'Tube Shaft', w1: 'Plan', w2: '', w3: 'Actual', w4: '' },
  { product: 'Yoke Shaft', w1: '', w2: 'Plan', w3: '', w4: 'Actual' },
  { product: 'UJ Cross', w1: 'Plan', w2: 'Actual', w3: '', w4: '' },
];

const DockAuditPlanView = () => {
  return (
    <div className="mt-4">
      <h5 className="fw-bold">📅 Dock Audit Plan 2025 (Live Status)</h5>
      <Table bordered size="sm" className="text-center small">
        <thead className="table-dark">
          <tr>
            <th>Product Family</th>
            <th>Week 1</th>
            <th>Week 2</th>
            <th>Week 3</th>
            <th>Week 4</th>
          </tr>
        </thead>
        <tbody>
          {DUMMY_PLAN.map((row, idx) => (
            <tr key={idx}>
              <td className="fw-bold text-start">{row.product}</td>
              <td className={row.w1 === 'Actual' ? 'bg-success text-white' : row.w1 === 'Plan' ? 'bg-warning' : ''}>{row.w1}</td>
              <td className={row.w2 === 'Actual' ? 'bg-success text-white' : row.w2 === 'Plan' ? 'bg-warning' : ''}>{row.w2}</td>
              <td className={row.w3 === 'Actual' ? 'bg-success text-white' : row.w3 === 'Plan' ? 'bg-warning' : ''}>{row.w3}</td>
              <td className={row.w4 === 'Actual' ? 'bg-success text-white' : row.w4 === 'Plan' ? 'bg-warning' : ''}>{row.w4}</td>
            </tr>
          ))}
        </tbody>
      </Table>
    </div>
  );
};

export default DockAuditPlanView;