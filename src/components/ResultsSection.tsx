import { Button, Card, Form } from 'react-bootstrap';
import { DrawResult } from '../types';

interface ResultsSectionProps {
  results: DrawResult[];
  onRedraw: (index: number) => void;
  onCopy: (index: number) => void;
  onMemoChange: (index: number, memo: string) => void;
  onClear: () => void;
  onDownloadLog: () => void;
}

export const ResultsSection = ({
  results,
  onRedraw,
  onCopy,
  onMemoChange,
  onClear,
  onDownloadLog,
}: ResultsSectionProps) => {
  if (results.length === 0) {
    return null;
  }

  return (
    <section>
      <h3 className="h4 mb-3">抽選結果</h3>
      <div className="mb-3">
        {results.map((result, index) => (
          <Card
            key={result.id}
            className={`mb-3 ${result.isReverse ? 'border-warning' : ''}`}
          >
            <Card.Body>
              <div className="d-flex justify-content-between align-items-start mb-2">
                <div className="flex-grow-1">
                  <Card.Title className="h5">{result.text}</Card.Title>
                  {result.isReverse && (
                    <small className="text-warning">逆回答モード</small>
                  )}
                </div>
                <div className="d-flex gap-2">
                  <Button
                    variant="outline-primary"
                    size="sm"
                    onClick={() => onRedraw(index)}
                  >
                    再抽選
                  </Button>
                  <Button
                    variant="outline-secondary"
                    size="sm"
                    onClick={() => onCopy(index)}
                  >
                    コピー
                  </Button>
                </div>
              </div>
              <Form.Group>
                <Form.Label>メモ・備考：</Form.Label>
                <Form.Control
                  as="textarea"
                  rows={2}
                  placeholder="メモを入力..."
                  value={result.memo}
                  onChange={(e) => onMemoChange(index, e.target.value)}
                />
              </Form.Group>
            </Card.Body>
          </Card>
        ))}
      </div>
      <div className="d-flex gap-2">
        <Button variant="primary" onClick={onDownloadLog}>
          ログをダウンロード
        </Button>
        <Button variant="secondary" onClick={onClear}>
          結果をクリア
        </Button>
      </div>
    </section>
  );
};
