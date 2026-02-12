import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Container, Form, ListGroup } from 'react-bootstrap';
import { supabase } from '../lib/supabase';

type GameState = {
  id: string;
  room_id: string;
  current_topic: string | null;
  phase: 'lobby' | 'waiting' | 'topic_drawn' | 'answering' | 'voting' | 'results';
  round: number;
  created_at: string;
  updated_at: string;
};

type Answer = {
  id: string;
  room_id: string;
  game_state_id: string;
  user_id: string;
  user_name: string;
  answer_text: string;
  votes: number;
  created_at: string;
  updated_at: string;
};

interface PlayerViewProps {
  roomId: string;
  userId: string;
  userName: string;
  onLeaveRoom: () => void;
}

export const PlayerView = ({
  roomId,
  userId,
  userName,
  onLeaveRoom,
}: PlayerViewProps) => {
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [myAnswer, setMyAnswer] = useState('');
  const [hasVoted, setHasVoted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const gameStateChannelRef = useRef<RealtimeChannel | null>(null);
  const answersChannelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    loadGameState();
    loadAnswers();
    subscribeToGameState();
    subscribeToAnswers();

    // Realtimeが動作しない場合のバックアップとしてポーリングを追加
    pollingIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        console.log('[Player] ポーリングでgame_state取得');
        loadGameState();
        loadAnswers();
      }
    }, 3000); // 3秒ごと

    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (gameStateChannelRef.current) {
        console.log('[Player] GameState Realtime接続解除');
        supabase.removeChannel(gameStateChannelRef.current);
        gameStateChannelRef.current = null;
      }
      if (answersChannelRef.current) {
        console.log('[Player] Answers Realtime接続解除');
        supabase.removeChannel(answersChannelRef.current);
        answersChannelRef.current = null;
      }
    };
  }, [roomId]);

  // gameStateが変わったらanswersも再取得
  useEffect(() => {
    if (gameState?.id) {
      loadAnswers();
    }
  }, [gameState?.id]);

  const loadGameState = async () => {
    // maybeSingle()を使用：レコードが0件でもエラーにならない
    const { data } = await supabase
      .from('game_state')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();

    if (data) {
      setGameState(data);
    }
  };

  const loadAnswers = async () => {
    if (!gameState?.id) return;

    const { data } = await supabase
      .from('answers')
      .select('*')
      .eq('game_state_id', gameState.id)
      .order('created_at', { ascending: true });

    if (data) {
      setAnswers(data);
    }
  };

  const subscribeToGameState = () => {
    // 既存のチャンネルがあれば先に解除
    if (gameStateChannelRef.current) {
      supabase.removeChannel(gameStateChannelRef.current);
    }

    const channel = supabase
      .channel(`room:${roomId}:game_state:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'game_state',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('[Player] ゲーム状態変更検知:', payload);
          if (isMountedRef.current) {
            loadGameState();
          }
        }
      )
      .subscribe((status) => {
        console.log('[Player] GameState Realtime接続状態:', status);
      });

    gameStateChannelRef.current = channel;
  };

  const subscribeToAnswers = () => {
    // 既存のチャンネルがあれば先に解除
    if (answersChannelRef.current) {
      supabase.removeChannel(answersChannelRef.current);
    }

    const channel = supabase
      .channel(`room:${roomId}:answers:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'answers',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('[Player] 回答変更検知:', payload);
          if (isMountedRef.current) {
            loadAnswers();
          }
        }
      )
      .subscribe((status) => {
        console.log('[Player] Answers Realtime接続状態:', status);
      });

    answersChannelRef.current = channel;
  };

  const handleSubmitAnswer = async () => {
    if (!gameState?.id || !myAnswer.trim()) {
      console.log('[Player] 回答送信スキップ: gameState=', gameState?.id, 'myAnswer=', myAnswer);
      return;
    }

    // 二重送信防止
    if (isSubmitting) {
      console.log('[Player] 送信中のためスキップ');
      return;
    }

    setIsSubmitting(true);
    console.log('[Player] 回答送信開始:', myAnswer.trim());

    try {
      const { data, error } = await supabase.from('answers').insert({
        room_id: roomId,
        game_state_id: gameState.id,
        user_id: userId,
        user_name: userName,
        answer_text: myAnswer.trim(),
      } as any).select();

      if (error) {
        console.error('[Player] 回答送信エラー:', error);
        alert('回答の送信に失敗しました: ' + error.message);
      } else {
        console.log('[Player] 回答送信成功:', data);
        setMyAnswer('');
        // 回答を再読み込み
        loadAnswers();
      }
    } catch (err) {
      console.error('[Player] 回答送信例外:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVote = async (answerId: string) => {
    if (hasVoted) return;

    const { error } = await supabase.from('votes').insert({
      room_id: roomId,
      answer_id: answerId,
      user_id: userId,
    } as any);

    if (!error) {
      setHasVoted(true);
      // 投票数を更新
      const answer = answers.find((a) => a.id === answerId);
      if (answer) {
        await supabase
          .from('answers')
          .update({ votes: answer.votes + 1 } as any)
          .eq('id', answerId);
      }
    }
  };

  const myAnswerData = answers.find((a) => a.user_id === userId);
  const canAnswer =
    gameState?.phase === 'answering' && !myAnswerData;
  const canVote =
    gameState?.phase === 'voting' && !hasVoted && answers.length > 0;

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h2 style={{ color: '#0066cc', fontWeight: 'bold' }}>エルそれ！ - プレイヤー</h2>
          <p className="mb-0" style={{ color: '#ffd700', fontWeight: '600' }}>ラウンド {gameState?.round || 0}</p>
        </div>
        <Button variant="outline-secondary" size="sm" onClick={onLeaveRoom}>
          退出
        </Button>
      </div>

      {gameState?.phase === 'lobby' && (
        <Card className="mb-4">
          <Card.Body className="text-center py-5">
            <h4>ディーラーがセッションを開始するまでお待ちください</h4>
            <p className="text-muted">プレイヤーが揃うまでしばらくお待ちください</p>
          </Card.Body>
        </Card>
      )}

      {gameState?.phase === 'waiting' && (
        <Card className="mb-4">
          <Card.Body className="text-center py-5">
            <h4>ディーラーがお題を出題するまでお待ちください</h4>
          </Card.Body>
        </Card>
      )}

      {gameState?.phase === 'topic_drawn' && gameState?.current_topic && (
        <Card className="mb-4 border-primary">
          <Card.Header className="bg-primary text-white">
            <strong>お題が発表されました！</strong>
          </Card.Header>
          <Card.Body>
            <h3 className="text-center">{gameState.current_topic}</h3>
            <p className="text-center text-muted mt-3 mb-0">
              ディーラーが回答受付を開始するまでお待ちください
            </p>
          </Card.Body>
        </Card>
      )}

      {gameState?.phase !== 'topic_drawn' && gameState?.current_topic && (
        <Card className="mb-4">
          <Card.Header>
            <strong>お題</strong>
          </Card.Header>
          <Card.Body>
            <h3 className="text-center">{gameState.current_topic}</h3>
          </Card.Body>
        </Card>
      )}

      {canAnswer && (
        <Card className="mb-4">
          <Card.Header>
            <strong>回答を入力</strong>
          </Card.Header>
          <Card.Body>
            <Form>
              <Form.Group className="mb-3">
                <Form.Control
                  as="textarea"
                  rows={3}
                  placeholder="あなたの回答を入力してください"
                  value={myAnswer}
                  onChange={(e) => setMyAnswer(e.target.value)}
                  disabled={isSubmitting}
                />
              </Form.Group>
              <Button
                variant="primary"
                onClick={handleSubmitAnswer}
                disabled={!myAnswer.trim() || isSubmitting}
              >
                {isSubmitting ? '送信中...' : '回答を送信'}
              </Button>
            </Form>
          </Card.Body>
        </Card>
      )}

      {/* 回答済みの場合 */}
      {gameState?.phase === 'answering' && myAnswerData && (
        <Card className="mb-4 border-success">
          <Card.Header className="bg-success text-white">
            <strong>回答済み</strong>
          </Card.Header>
          <Card.Body>
            <p className="mb-1"><strong>あなたの回答:</strong></p>
            <p className="mb-0">{myAnswerData.answer_text}</p>
            <p className="text-muted mt-2 mb-0 small">
              他のプレイヤーが回答するまでお待ちください
            </p>
          </Card.Body>
        </Card>
      )}

      {myAnswerData && gameState?.phase === 'answering' && (
        <Card className="mb-4">
          <Card.Body className="text-center">
            <Badge bg="success" className="mb-2">
              回答済み
            </Badge>
            <p className="mb-0">他のプレイヤーの回答を待っています...</p>
          </Card.Body>
        </Card>
      )}

      {(gameState?.phase === 'voting' || gameState?.phase === 'results') && (
        <Card>
          <Card.Header>
            <strong>
              {gameState.phase === 'voting' ? '投票' : '結果'}
            </strong>
          </Card.Header>
          <ListGroup variant="flush">
            {answers.map((answer) => (
              <ListGroup.Item
                key={answer.id}
                className="d-flex justify-content-between align-items-center"
              >
                <div>
                  <div>
                    <strong>{answer.user_name}</strong>
                  </div>
                  <div>{answer.answer_text}</div>
                </div>
                <div className="d-flex gap-2 align-items-center">
                  {gameState.phase === 'results' && (
                    <Badge bg="primary">{answer.votes} 票</Badge>
                  )}
                  {gameState.phase === 'voting' && canVote && (
                    <Button
                      size="sm"
                      variant="outline-primary"
                      onClick={() => handleVote(answer.id)}
                      disabled={hasVoted || answer.user_id === userId}
                    >
                      投票
                    </Button>
                  )}
                </div>
              </ListGroup.Item>
            ))}
          </ListGroup>
        </Card>
      )}
    </Container>
  );
};
