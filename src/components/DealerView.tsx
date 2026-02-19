import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { Button, Card, Container, Form, ListGroup } from 'react-bootstrap';
import { useGameLogic } from '../hooks/useGameLogic';
import { supabase } from '../lib/supabase';

type GameState = {
  id: string;
  room_id: string;
  current_topic: string | null;
  phase: 'lobby' | 'waiting' | 'topic_drawn' | 'answering' | 'revealing' | 'voting' | 'results';
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
  is_revealed: boolean;
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
  userId,
  userName,
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
  const [myAnswer, setMyAnswer] = useState('');
  const [hasVoted, setHasVoted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const playersChannelRef = useRef<RealtimeChannel | null>(null);
  const answersChannelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const gameStateIdRef = useRef<string | null>(null);
  const realtimeConnectedRef = useRef(false);

  // ポーリングを開始する関数
  const startPolling = () => {
    if (pollingIntervalRef.current) return; // 既にポーリング中なら何もしない

    console.log('[Dealer] Realtimeバックアップ: ポーリング開始');
    pollingIntervalRef.current = setInterval(() => {
      if (isMountedRef.current && !realtimeConnectedRef.current) {
        console.log('[Dealer] ポーリングで回答取得');
        loadAnswers();
      }
    }, 5000); // 5秒ごと（バックアップなので長めの間隔）
  };

  // ポーリングを停止する関数
  const stopPolling = () => {
    if (pollingIntervalRef.current) {
      console.log('[Dealer] ポーリング停止（Realtime接続成功）');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    initGameState();
    loadPlayers();
    subscribeToPlayers();
    subscribeToAnswers();

    // 初期状態ではポーリングを開始（Realtime接続確立まで）
    startPolling();

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

  // gameStateが設定されたら回答を読み込む
  useEffect(() => {
    if (gameState?.id) {
      console.log('[Dealer] gameState設定検知: 回答を読み込みます');
      loadAnswers();
    }
  }, [gameState?.id]);

  // フェーズが変わったときの処理
  useEffect(() => {
    if (gameState?.phase === 'lobby' || gameState?.phase === 'waiting') {
      // ロビーまたは待機フェーズになったら投票状態をリセット
      console.log('[Dealer] フェーズ変更: 投票状態リセット');
      setHasVoted(false);
    } else if (gameState?.phase === 'answering') {
      // 回答募集フェーズになったら投票状態をリセット
      console.log('[Dealer] フェーズ変更: 投票状態リセット（answering）');
      setHasVoted(false);
    }
  }, [gameState?.phase]);

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
          console.log('[Dealer] 回答変更検知（Realtime）:', payload);
          if (isMountedRef.current) {
            // gameStateIdRefを使用して、gameStateが未設定でも取得できるようにする
            loadAnswers();
          }
        }
      )
      .subscribe((status) => {
        console.log('[Dealer] Answers Realtime接続状態:', status);

        if (status === 'SUBSCRIBED') {
          // Realtime接続成功 - ポーリングを停止
          realtimeConnectedRef.current = true;
          stopPolling();
        } else if (status === 'CLOSED' || status === 'CHANNEL_ERROR') {
          // Realtime接続失敗 - ポーリングを再開
          realtimeConnectedRef.current = false;
          startPolling();
        }
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

  const handleStartAnswer = async () => {
    if (!gameState?.current_topic) {
      alert('お題が設定されていません');
      return;
    }

    console.log('[Dealer] 回答募集開始: 古い回答をクリア');

    // 念のため、古い回答をクリア
    await supabase
      .from('lsore_answers')
      .delete()
      .eq('game_state_id', gameState.id);

    // ローカルの回答もクリア
    setAnswers([]);

    const { error } = await supabase
      .from('lsore_game_state')
      .update({
        phase: 'answering',
        round: gameState.round + 1,
      } as any)
      .eq('id', gameState.id);

    if (!error) {
      console.log('[Dealer] 回答募集フェーズに移行しました');
      setGameState({
        ...gameState,
        phase: 'answering',
        round: gameState.round + 1,
      });
    } else {
      console.error('[Dealer] フェーズ更新エラー:', error);
    }
  };

  const handleSubmitAnswer = async () => {
    if (!gameState?.id || !myAnswer.trim()) {
      console.log('[Dealer] 回答送信スキップ: gameState=', gameState?.id, 'myAnswer=', myAnswer);
      return;
    }

    // 二重送信防止
    if (isSubmitting) {
      console.log('[Dealer] 送信中のためスキップ');
      return;
    }

    setIsSubmitting(true);
    console.log('[Dealer] 回答送信開始:', myAnswer.trim());

    try {
      const { data, error } = await supabase.from('lsore_answers').insert({
        room_id: roomId,
        game_state_id: gameState.id,
        user_id: userId,
        user_name: userName,
        answer_text: myAnswer.trim(),
        is_revealed: false,
      } as any).select();

      if (error) {
        console.error('[Dealer] 回答送信エラー:', error);
        alert('回答の送信に失敗しました: ' + error.message);
      } else {
        console.log('[Dealer] 回答送信成功:', data);
        setMyAnswer('');
        // 回答を再読み込み
        loadAnswers();
      }
    } catch (err) {
      console.error('[Dealer] 回答送信例外:', err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRevealAnswer = async (answerId: string) => {
    const { error } = await supabase
      .from('lsore_answers')
      .update({ is_revealed: true } as any)
      .eq('id', answerId);

    if (!error) {
      console.log('[Dealer] 回答を公開しました:', answerId);
      loadAnswers();
    } else {
      console.error('[Dealer] 回答公開エラー:', error);
    }
  };

  const handleStartRevealing = async () => {
    if (!gameState) return;

    console.log('[Dealer] 開示フェーズへ移行');

    // フェーズをrevealingに変更
    const { error } = await supabase
      .from('lsore_game_state')
      .update({ phase: 'revealing' } as any)
      .eq('id', gameState.id);

    if (!error) {
      console.log('[Dealer] 開示フェーズに移行しました');
      setGameState({ ...gameState, phase: 'revealing' });
    }
  };

  const handleStartVoting = async () => {
    if (!gameState) return;

    console.log('[Dealer] 投票開始');

    // フェーズを投票に変更（回答は既に公開済み）
    const { error } = await supabase
      .from('lsore_game_state')
      .update({ phase: 'voting' } as any)
      .eq('id', gameState.id);

    if (!error) {
      console.log('[Dealer] 投票フェーズに移行しました');
      setGameState({ ...gameState, phase: 'voting' });
    }
  };

  const handleVote = async (answerId: string) => {
    if (hasVoted) return;

    // 投票を記録
    const { error } = await supabase.from('lsore_votes').insert({
      room_id: roomId,
      answer_id: answerId,
      user_id: userId,
    } as any);

    if (!error) {
      // 投票数をアトミックにインクリメント（競合状態を防ぐ）
      const { error: incrementError } = await supabase.rpc('increment_answer_votes', {
        answer_id_param: answerId,
      });

      if (incrementError) {
        console.error('[Dealer] 投票数更新エラー:', incrementError);
      } else {
        console.log('[Dealer] 投票成功:', answerId);
      }

      setHasVoted(true);
      // 回答を再読み込みして最新の投票数を表示
      loadAnswers();
    } else {
      console.error('[Dealer] 投票記録エラー:', error);
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

    console.log('[Dealer] 次のラウンド開始: 回答と投票をクリア');

    // 回答と投票をクリア
    const { error: answersDeleteError } = await supabase
      .from('lsore_answers')
      .delete()
      .eq('game_state_id', gameState.id);

    if (answersDeleteError) {
      console.error('[Dealer] 回答削除エラー:', answersDeleteError);
    } else {
      console.log('[Dealer] 回答削除成功');
    }

    const { error: votesDeleteError } = await supabase
      .from('lsore_votes')
      .delete()
      .eq('room_id', roomId);

    if (votesDeleteError) {
      console.error('[Dealer] 投票削除エラー:', votesDeleteError);
    } else {
      console.log('[Dealer] 投票削除成功');
    }

    const { error } = await supabase
      .from('lsore_game_state')
      .update({
        phase: 'lobby',
        current_topic: null,
      } as any)
      .eq('id', gameState.id);

    if (!error) {
      console.log('[Dealer] ゲーム状態をロビーに戻しました');
      setGameState({
        ...gameState,
        phase: 'lobby',
        current_topic: null,
      });
      setAnswers([]);
      setHasVoted(false);
    } else {
      console.error('[Dealer] ゲーム状態更新エラー:', error);
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
            {gameState?.phase === 'revealing' && '回答開示中'}
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
              <Button variant="success" onClick={handleStartAnswer}>
                回答受付開始
              </Button>
            )}
            {gameState?.phase === 'answering' && (
              <>
                <Button variant="primary" onClick={handleStartRevealing}>
                  回答締め切り ({answers.length}件の回答)
                </Button>
              </>
            )}
            {gameState?.phase === 'revealing' && (
              <Button
                variant="success"
                onClick={handleStartVoting}
                disabled={answers.some(a => !a.is_revealed)}
              >
                投票開始 {answers.some(a => !a.is_revealed) && `(未公開: ${answers.filter(a => !a.is_revealed).length}件)`}
              </Button>
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
        gameState?.phase === 'revealing' ||
        gameState?.phase === 'voting' ||
        gameState?.phase === 'results') && (
          <Card className="mb-4">
            <Card.Header>
              <strong>回答一覧</strong>
            </Card.Header>
            <Card.Body>
              {answers.length === 0 ? (
                <p className="text-center text-muted mb-0">まだ回答がありません</p>
              ) : (
                <>
                  {gameState.phase === 'answering' ? (
                    <p className="text-center mb-0">
                      <strong>{answers.length}件</strong>の回答が届いています
                      <br />
                      <span className="text-muted small">
                        回答締め切り後に内容を確認できます
                      </span>
                    </p>
                  ) : gameState.phase === 'voting' ? (
                    <ListGroup variant="flush">
                      {answers.filter(a => a.is_revealed).length === 0 ? (
                        <ListGroup.Item className="text-center text-muted">
                          公開された回答がまだありません
                        </ListGroup.Item>
                      ) : (
                        answers.filter(a => a.is_revealed).map((answer) => (
                          <ListGroup.Item key={answer.id}>
                            <div className="d-flex justify-content-between align-items-center">
                              <div className="flex-grow-1">
                                <strong>{answer.user_name}:</strong> {answer.answer_text}
                              </div>
                              <div className="d-flex gap-2 align-items-center">
                                <Button
                                  size="sm"
                                  variant="outline-primary"
                                  onClick={() => handleVote(answer.id)}
                                  disabled={hasVoted}
                                >
                                  投票
                                </Button>
                              </div>
                            </div>
                          </ListGroup.Item>
                        ))
                      )}
                    </ListGroup>
                  ) : (
                    <ListGroup variant="flush">
                      {answers.map((answer) => (
                        <ListGroup.Item key={answer.id}>
                          <div className="d-flex justify-content-between align-items-center">
                            <div className="flex-grow-1">
                              {answer.is_revealed ? (
                                <>
                                  <strong>{answer.user_name}:</strong> {answer.answer_text}
                                </>
                              ) : (
                                <span className="text-muted">
                                  <strong>{answer.user_name}:</strong> [未公開]
                                </span>
                              )}
                            </div>
                            <div className="d-flex gap-2 align-items-center">
                              {gameState.phase === 'results' && answer.is_revealed && (
                                <span className="text-primary">{answer.votes} 票</span>
                              )}
                              {gameState.phase === 'revealing' && !answer.is_revealed && (
                                <Button
                                  size="sm"
                                  variant="primary"
                                  onClick={() => handleRevealAnswer(answer.id)}
                                >
                                  公開
                                </Button>
                              )}
                            </div>
                          </div>
                        </ListGroup.Item>
                      ))}
                    </ListGroup>
                  )}
                </>
              )}
            </Card.Body>
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
      {(gameState?.phase === 'answering' || gameState?.phase === 'revealing' || gameState?.phase === 'voting' || gameState?.phase === 'results') && gameState?.current_topic && (
        <Card className="mb-4">
          <Card.Header>
            <strong>お題</strong>
          </Card.Header>
          <Card.Body>
            <p className="text-center mb-0">{gameState.current_topic}</p>
          </Card.Body>
        </Card>
      )}

      {/* ディーラーの回答入力（回答受付中のみ） */}
      {gameState?.phase === 'answering' && (
        (() => {
          const myAnswerData = answers.find((a) => a.user_id === userId);
          const canAnswer = !myAnswerData;

          return canAnswer ? (
            <Card className="mb-4">
              <Card.Header>
                <strong>あなたの回答を入力</strong>
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
          ) : (
            <Card className="mb-4 border-success">
              <Card.Header className="bg-success text-white">
                <strong>回答済み</strong>
              </Card.Header>
              <Card.Body>
                <p className="mb-1"><strong>あなたの回答:</strong></p>
                <p className="mb-0">{myAnswerData.answer_text}</p>
              </Card.Body>
            </Card>
          );
        })()
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
