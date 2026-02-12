import { useState } from 'react';
import { Button, Card, Container, Form } from 'react-bootstrap';

interface RoomLoginProps {
  onJoinRoom: (roomId: string, userName: string, role: 'dealer' | 'player') => void;
}

export const RoomLogin = ({ onJoinRoom }: RoomLoginProps) => {
  const [userName, setUserName] = useState('');
  const [roomPassword, setRoomPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleJoin = async (role: 'dealer' | 'player') => {
    if (!userName.trim() || !roomPassword.trim()) {
      alert('ユーザー名と合言葉を入力してください');
      return;
    }

    setIsLoading(true);
    try {
      // ここでは合言葉をそのままルームIDとして使用
      await onJoinRoom(roomPassword, userName.trim(), role);
    } catch (error) {
      console.error('入室エラー:', error);
      alert('入室に失敗しました');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Container className="py-5">
      <div className="d-flex justify-content-center">
        <Card style={{ maxWidth: '500px', width: '100%' }}>
          <Card.Body className="p-4">
            <h2 className="text-center mb-4">エルそれ！</h2>
            <p className="text-center text-muted mb-4">
              ～エルバニアではそれが正解～
            </p>

            <Form>
              <Form.Group className="mb-3">
                <Form.Label>ユーザー名</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="表示名を入力"
                  value={userName}
                  onChange={(e) => setUserName(e.target.value)}
                  disabled={isLoading}
                />
              </Form.Group>

              <Form.Group className="mb-4">
                <Form.Label>合言葉（ルームID）</Form.Label>
                <Form.Control
                  type="text"
                  placeholder="合言葉を入力"
                  value={roomPassword}
                  onChange={(e) => setRoomPassword(e.target.value)}
                  disabled={isLoading}
                />
                <Form.Text className="text-muted">
                  参加したいルームの合言葉を入力してください
                </Form.Text>
              </Form.Group>

              <div className="d-grid gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={() => handleJoin('dealer')}
                  disabled={isLoading}
                >
                  ディーラーとして入室
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={() => handleJoin('player')}
                  disabled={isLoading}
                >
                  プレイヤーとして入室
                </Button>
              </div>
            </Form>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
};
