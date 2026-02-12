import { useState } from 'react';
import { Button, Form } from 'react-bootstrap';

interface DrawSectionProps {
  onDrawOne: (maxDraw: number) => void;
  onDrawMax: (maxDraw: number) => void;
}

export const DrawSection = ({ onDrawOne, onDrawMax }: DrawSectionProps) => {
  const [maxDraw, setMaxDraw] = useState(5);

  return (
    <section className="mb-4">
      <h2 className="h4 mb-3">抽選</h2>
      <Form.Group className="mb-3">
        <Form.Label>最大抽選数：</Form.Label>
        <Form.Control
          type="number"
          min="1"
          max="10"
          value={maxDraw}
          onChange={(e) => setMaxDraw(parseInt(e.target.value) || 5)}
        />
      </Form.Group>
      <div className="d-flex gap-2 flex-wrap">
        <Button
          variant="primary"
          size="lg"
          onClick={() => onDrawOne(maxDraw)}
        >
          抽選（1つ追加）
        </Button>
        <Button
          variant="primary"
          size="lg"
          onClick={() => onDrawMax(maxDraw)}
        >
          一括抽選（満枠まで）
        </Button>
      </div>
    </section>
  );
};
