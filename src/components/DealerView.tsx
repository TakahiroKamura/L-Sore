import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, Container, ListGroup } from 'react-bootstrap';
import { useGameLogic } from '../hooks/useGameLogic';
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

type Player = {
  id: string;
  room_id: string;
  user_id: string;
  user_name: string;
  role: 'dealer' | 'player';
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

interface DealerViewProps {
  roomId: string;
  userId: string;
  userName: string;
  onLeaveRoom: () => void;
}

export const DealerView = ({
  roomId,
  onLeaveRoom,
}: DealerViewProps) => {
  const {
    settings,
    drawOneTopic,
    clearResults,
  } = useGameLogic();

  const [gameState, setGameState] = useState<GameState | null>(null);
  const [answers, setAnswers] = useState<Answer[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);
  const playersChannelRef = useRef<RealtimeChannel | null>(null);
  const answersChannelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameStateIdRef = useRef<string | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    initGameState();
    loadPlayers();
    subscribeToPlayers();
    subscribeToAnswers();

    // Realtimeが動作しない場合のバックアップとしてポーリングを追加
    pollingIntervalRef.current = setInterval(() => {
      if (isMountedRef.current) {
        console.log('[Dealer] ポーリングで回答取得');
        loadAnswers();
      }
    }, 3000); // 3秒ごと

    return () => {
      isMountedRef.current = false;
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
      if (playersChannelRef.current) {
        console.log('[Dealer] Players Realtime接続解除');
        supabase.removeChannel(playersChannelRef.current);
        playersChannelRef.current = null;
      }
      if (answersChannelRef.current) {
        console.log('[Dealer] Answers Realtime接続解除');
        supabase.removeChannel(answersChannelRef.current);
        answersChannelRef.current = null;
      }
    };
  }, [roomId]);

  const initGameState = async () => {
    console.log('[Dealer] initGameState呼び出し: roomId=', roomId);
    // 既存のゲーム状態を取得
    // maybeSingle()を使用：レコードが0件でもエラーにならない
    let { data: existingState, error: fetchError } = await supabase
      .from('lsore_game_state')
      .select('*')
      .eq('room_id', roomId)
      .maybeSingle();

    if (fetchError) {
      console.error('[Dealer] game_state取得エラー:', fetchError);
    }
    console.log('[Dealer] 既存のgame_state:', existingState);

    if (!existingState) {
      // 新規作成（初期状態はlobby）
      console.log('[Dealer] game_stateを新規作成します');
      const { data: newState, error: insertError } = await supabase
        .from('lsore_game_state')
        .insert({
          room_id: roomId,
          phase: 'lobby',
          round: 0,
        } as any)
        .select()
        .single();

      if (insertError) {
        console.error('[Dealer] game_state作成エラー:', insertError);
      } else {
        console.log('[Dealer] game_state作成成功:', newState);
      }
      existingState = newState;
    }

    if (existingState) {
      console.log('[Dealer] gameStateをセット:', existingState);
      setGameState(existingState as GameState);
      gameStateIdRef.current = existingState.id;
    }
  };

  const loadAnswers = async () => {
    const gsId = gameStateIdRef.current;
    if (!gsId) {
      console.log('[Dealer] loadAnswers: gameStateIdがないためスキップ');
      return;
    }

    const { data, error } = await supabase
      .from('lsore_answers')
      .select('*')
      .eq('game_state_id', gsId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Dealer] 回答読み込みエラー:', error);
    } else if (data) {
      console.log('[Dealer] 回答読み込み成功:', data.length, '件', data);
      setAnswers(data);
    }
  };

  const loadPlayers = async () => {
    console.log('[Dealer] loadPlayers呼び出し: roomId=', roomId);
    const { data, error } = await supabase
      .from('lsore_players')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Dealer] プレイヤー読み込みエラー:', error);
    } else if (data) {
      console.log('[Dealer] プレイヤー読み込み成功:', data.length, '人', data);
      setPlayers(data);
    }
  };

  const subscribeToPlayers = () => {
    // 既存のチャンネルがあれば先に解除
    if (playersChannelRef.current) {
      supabase.removeChannel(playersChannelRef.current);
    }

    const channel = supabase
      .channel(`dealer:${roomId}:players:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lsore_players',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('[Dealer] プレイヤー変更検知:', payload);
          if (isMountedRef.current) {
            loadPlayers();
          }
        }
      )
      .subscribe((status) => {
        console.log('[Dealer] Realtime接続状態:', status);
      });

    playersChannelRef.current = channel;
  };

  const subscribeToAnswers = () => {
    // 既存のチャンネルがあれば先に解除
    if (answersChannelRef.current) {
      supabase.removeChannel(answersChannelRef.current);
    }

    const channel = supabase
      .channel(`dealer:${roomId}:answers:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lsore_answers',
          filter: `room_id=eq.${roomId}`,
        },
        async (payload) => {
          console.log('[Dealer] 回答変更検知:', payload);
          if (isMountedRef.current && gameState?.id) {
            const { data } = await supabase
              .from('lsore_answers')
              .select('*')
              .eq('game_state_id', gameState.id);

            if (data && isMountedRef.current) {
              setAnswers(data);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('[Dealer] Answers Realtime接続状態:', status);
      });

    answersChannelRef.current = channel;
  };

  const handleStartSession = async () => {
    if (!gameState) return;

    const { error } = await supabase
      .from('lsore_game_state')
      .update({ phase: 'waiting' } as any)
      .eq('id', gameState.id);

    if (!error) {
      setGameState({ ...gameState, phase: 'waiting' });
    }
  };

  const handleDrawTopic = async () => {
    if (!gameState) return;

    // 最大3個まで抽選できると仮定
    const drawnTopic = drawOneTopic(3);

    // 抽選したお題をDBに書き込み、フェーズを更新
    if (drawnTopic) {
      const topicText = drawnTopic.text;
      console.log('[Dealer] 抽選したお題:', topicText);

      const { error } = await supabase
        .from('lsore_game_state')
        .update({
          current_topic: topicText,
          phase: 'topic_drawn',
        } as any)
        .eq('id', gameState.id);

      if (!error) {
        setGameState({
          ...gameState,
          current_topic: topicText,
          phase: 'topic_drawn',
        });
        console.log('[Dealer] お題をDBに保存しました');
      } else {
        console.error('[Dealer] お題の保存に失敗:', error);
      }
    }
  };

  const handleRedrawTopic = async () => {
    if (!gameState) return;

    // 新しいお題を抽選（maxDrawは無視してローカルの結果をクリアしてから抽選）
    clearResults(); // ローカルの結果をクリア

    const drawnTopic = drawOneTopic(10); // 十分大きな値を指定

    if (drawnTopic) {
      const topicText = drawnTopic.text;
      console.log('[Dealer] 再抽選したお題:', topicText);

      const { error } = await supabase
        .from('lsore_game_state')
        .update({
          current_topic: topicText,
        } as any)
        .eq('id', gameState.id);

      if (!error) {
        setGameState({
          ...gameState,
          current_topic: topicText,
        });
        console.log('[Dealer] 再抽選したお題をDBに保存しました');
      } else {
        console.error('[Dealer] 再抽選お題の保存に失敗:', error);
      }
    }
  };

  const handleCopyTopic = () => {
    if (!gameState?.current_topic) return;

    const copyText = `【${settings.appTitle}】お題「${gameState.current_topic}」を使ってゲーム中！　気になった人はこちら！${settings.streamUrl} ${settings.hashtag}`;

    navigator.clipboard.writeText(copyText).then(() => {
      alert('クリップボードにコピーしました！');
    }).catch((err) => {
      console.error('[Dealer] コピーに失敗:', err);
      alert('コピーに失敗しました');
    });
  };

  const handleStartAnswering = async () => {
    if (!gameState?.current_topic) {
      alert('お題が設定されていません');
      return;
    }

    const { error } = await supabase
      .from('lsore_game_state')
      .update({
        phase: 'answering',
        round: gameState.round + 1,
      } as any)
      .eq('id', gameState.id);

    if (!error) {
      setGameState({
        ...gameState,
        phase: 'answering',
        round: gameState.round + 1,
      });
    }
  };

  const handleStartVoting = async () => {
    if (!gameState) return;

    const { error } = await supabase
      .from('lsore_game_state')
      .update({ phase: 'voting' } as any)
      .eq('id', gameState.id);

    if (!error) {
      setGameState({ ...gameState, phase: 'voting' });
    }
  };

  const handleShowResults = async () => {
    if (!gameState) return;

    const { error } = await supabase
      .from('lsore_game_state')
      .update({ phase: 'results' } as any)
      .eq('id', gameState.id);

    if (!error) {
      setGameState({ ...gameState, phase: 'results' });
    }
  };

  const handleNextRound = async () => {
    if (!gameState) return;

    // 回答と投票をクリア
    await supabase.from('lsore_answers').delete().eq('game_state_id', gameState.id);
    await supabase.from('lsore_votes').delete().eq('room_id', roomId);

    const { error } = await supabase
      .from('lsore_game_state')
      .update({
        phase: 'lobby',
        current_topic: null,
      } as any)
      .eq('id', gameState.id);

    if (!error) {
      setGameState({
        ...gameState,
        phase: 'lobby',
        current_topic: null,
      });
      setAnswers([]);
    }
  };

  return (
    <Container className="py-4">
      <div className="d-flex justify-content-between align-items-center mb-4">
        <div>
          <h1 className="display-4" style={{ color: '#0066cc', fontWeight: 'bold' }}>エルそれ！ - ディーラー</h1>
          <p style={{ color: '#ffd700', fontWeight: '600', fontSize: '1.1rem' }}>～エルバニアではそれが正解～</p>
        </div>
        <Button variant="outline-secondary" onClick={onLeaveRoom}>
          退出
        </Button>
      </div>

      <Card className="mb-4">
        <Card.Header>
          <strong>ゲーム進行</strong>
        </Card.Header>
        <Card.Body>
          <div className="mb-3">
            <strong>現在のフェーズ:</strong>{' '}
            {gameState?.phase === 'lobby' && 'セッション開始前'}
            {gameState?.phase === 'waiting' && '待機中'}
            {gameState?.phase === 'topic_drawn' && 'お題出題'}
            {gameState?.phase === 'answering' && '回答受付中'}
            {gameState?.phase === 'voting' && '投票中'}
            {gameState?.phase === 'results' && '結果表示'}
          </div>
          <div className="mb-3">
            <strong>ラウンド:</strong> {gameState?.round || 0}
          </div>
          <div className="mb-3">
            <strong>参加プレイヤー:</strong> {players.length}名
          </div>

          <div className="d-flex gap-2 flex-wrap">
            {(!gameState || gameState?.phase === 'lobby') && (
              <>
                <Button
                  variant="success"
                  onClick={handleStartSession}
                  disabled={!gameState || players.filter(p => p.role === 'player').length === 0}
                >
                  セッション開始（入室締め切り）
                </Button>
                {!gameState && (
                  <small className="text-warning align-self-center ms-2">
                    ゲーム状態を初期化中...
                  </small>
                )}
                {gameState && players.filter(p => p.role === 'player').length === 0 && (
                  <small className="text-muted align-self-center ms-2">
                    プレイヤーが1人以上必要です
                  </small>
                )}
              </>
            )}
            {gameState?.phase === 'waiting' && (
              <Button variant="primary" onClick={handleDrawTopic}>
                お題を抽選
              </Button>
            )}
            {gameState?.phase === 'topic_drawn' && (
              <Button variant="success" onClick={handleStartAnswering}>
                回答受付開始
              </Button>
            )}
            {gameState?.phase === 'answering' && (
              <>
                <Button variant="primary" onClick={handleStartVoting}>
                  投票開始 ({answers.length}件の回答)
                </Button>
              </>
            )}
            {gameState?.phase === 'voting' && (
              <Button variant="warning" onClick={handleShowResults}>
                結果発表
              </Button>
            )}
            {gameState?.phase === 'results' && (
              <Button variant="secondary" onClick={handleNextRound}>
                次のラウンド
              </Button>
            )}
          </div>
        </Card.Body>
      </Card>

      {(gameState?.phase === 'answering' ||
        gameState?.phase === 'voting' ||
        gameState?.phase === 'results') && (
          <Card className="mb-4">
            <Card.Header>
              <strong>回答一覧</strong>
            </Card.Header>
            <ListGroup variant="flush">
              {answers.length === 0 ? (
                <ListGroup.Item className="text-center text-muted">
                  まだ回答がありません
                </ListGroup.Item>
              ) : (
                answers.map((answer) => (
                  <ListGroup.Item key={answer.id}>
                    <div className="d-flex justify-content-between">
                      <div>
                        <strong>{answer.user_name}:</strong> {answer.answer_text}
                      </div>
                      {gameState?.phase === 'results' && (
                        <span className="text-primary">{answer.votes} 票</span>
                      )}
                    </div>
                  </ListGroup.Item>
                ))
              )}
            </ListGroup>
          </Card>
        )}

      {/* お題プレビュー（topic_drawnフェーズで表示） */}
      {gameState?.phase === 'topic_drawn' && gameState?.current_topic && (
        <Card className="mb-4 border-primary">
          <Card.Header className="bg-primary text-white">
            <strong>今回のお題</strong>
          </Card.Header>
          <Card.Body>
            <h3 className="text-center mb-3">{gameState.current_topic}</h3>
            <div className="d-flex gap-2 justify-content-center">
              <Button
                variant="outline-primary"
                onClick={handleRedrawTopic}
              >
                再抽選
              </Button>
              <Button
                variant="outline-secondary"
                onClick={handleCopyTopic}
              >
                コピー
              </Button>
            </div>
          </Card.Body>
        </Card>
      )}

      {/* 回答中もお題を表示 */}
      {(gameState?.phase === 'answering' || gameState?.phase === 'voting' || gameState?.phase === 'results') && gameState?.current_topic && (
        <Card className="mb-4">
          <Card.Header>
            <strong>お題</strong>
          </Card.Header>
          <Card.Body>
            <p className="text-center mb-0">{gameState.current_topic}</p>
          </Card.Body>
        </Card>
      )}

      {/* オフライン用設定（セッション開始前のみ表示） */}
      {(!gameState || gameState?.phase === 'lobby') && (
        <>
        </>
      )}

      <footer className="text-center mt-5">
        <p className="text-muted">(c) PMK Games. 2026</p>
      </footer>
    </Container>
  );
};
