import type { RealtimeChannel } from '@supabase/supabase-js';
import { useEffect, useRef, useState } from 'react';
import { Badge, Button, Card, Container, ListGroup } from 'react-bootstrap';
import { MAX_PLAYERS } from '../constants/game';
import { supabase } from '../lib/supabase';

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

interface RoomLobbyProps {
  roomId: string;
  userId: string;
  onEnterAsDealer: () => void;
  onEnterAsPlayer: () => void;
  onLeaveRoom: () => void;
}

export const RoomLobby = ({
  roomId,
  userId,
  onEnterAsDealer,
  onEnterAsPlayer,
  onLeaveRoom,
}: RoomLobbyProps) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [roomName, setRoomName] = useState('');
  const channelRef = useRef<RealtimeChannel | null>(null);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    loadRoomInfo();
    loadPlayers();
    subscribeToPlayers();

    return () => {
      isMountedRef.current = false;
      if (channelRef.current) {
        console.log('[Lobby] Realtime接続解除');
        supabase.removeChannel(channelRef.current);
        channelRef.current = null;
      }
    };
  }, [roomId]);

  const loadRoomInfo = async () => {
    const { data } = await supabase
      .from('lsore_rooms')
      .select('name')
      .eq('id', roomId)
      .single();

    if (data) {
      setRoomName(data.name);
    }
  };

  const loadPlayers = async () => {
    console.log('[Lobby] loadPlayers呼び出し: roomId=', roomId);
    const { data, error } = await supabase
      .from('lsore_players')
      .select('*')
      .eq('room_id', roomId)
      .eq('is_active', true)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('[Lobby] プレイヤー読み込みエラー:', error);
    } else if (data) {
      console.log('[Lobby] プレイヤー読み込み成功:', data.length, '人', data);
      setPlayers(data);
    }
  };

  const subscribeToPlayers = () => {
    // 既存のチャンネルがあれば先に解除
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current);
    }

    const channel = supabase
      .channel(`room:${roomId}:players:${Date.now()}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'lsore_players',
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          console.log('[Lobby] プレイヤー変更検知:', payload);
          if (isMountedRef.current) {
            loadPlayers();
          }
        }
      )
      .subscribe((status) => {
        console.log('[Lobby] Realtime接続状態:', status);
      });

    channelRef.current = channel;
  };

  const hasDealer = players.some((p) => p.role === 'dealer');
  const iAmDealer = players.some((p) => p.user_id === userId && p.role === 'dealer');
  const isRoomFull = players.length >= MAX_PLAYERS;
  const iAmInRoom = players.some((p) => p.user_id === userId);

  return (
    <Container className="py-5">
      <div className="d-flex justify-content-center">
        <Card style={{ maxWidth: '600px', width: '100%' }}>
          <Card.Body className="p-4">
            <div className="d-flex justify-content-between align-items-center mb-4">
              <h2 className="mb-0" style={{ color: '#0066cc', fontWeight: 'bold' }}>ルーム: {roomName || roomId}</h2>
              <Button variant="outline-secondary" onClick={onLeaveRoom}>
                退出
              </Button>
            </div>
 className="d-flex justify-content-between align-items-center">
            <strong>参加者一覧</strong>
            <Badge bg={isRoomFull ? 'danger' : 'success'}>
              {players.length}/{MAX_PLAYERS}
            </Badge
              <Card.Header>
              <strong>参加者一覧</strong>
            </Card.Header>
            <ListGroup variant="flush">
              {players.length === 0 ? (
                <ListGroup.Item className="text-center text-muted">
                  まだ誰も参加していません
                </ListGroup.Item>
              ) : (
                players.map((player) => (
                  <ListGroup.Item
                    key={player.id}
                    className="d-flex justify-content-between align-items-center"
                  >
                    <span>
                      {player.user_name}
                      {player.user_id === userId && (
                        <Badge bg="info" className="ms-2">
                          あなた
                        </Badge>
                      )}
                    </span>
                    <Badge
                      bg={player.role === 'dealer' ? 'primary' : 'secondary'}
                    >
                      {player.role === 'dealer' ? 'ディーラー' : 'プレイヤー'}
                    </Badge>
                  </ListGroup.Item>
            { isRoomFull && !iAmInRoom && (
                    <div className="alert alert-warning mb-3" role="alert">
                      <strong>ルームが満員です</strong><br />
                      現在 {MAX_PLAYERS} 人が参加しています。
                    </div>
                  )}

              <div className="d-grid gap-2">
                <Button
                  variant="primary"
                  size="lg"
                  onClick={onEnterAsDealer}
                  disabled={(hasDealer && !iAmDealer) || (isRoomFull && !iAmInRoom)}
                >
                  {iAmDealer
                    ? 'ディーラーとして開始'
                    : hasDealer
                      ? 'ディーラーは既にいます'
                      : 'ディーラーとして開始'}
                </Button>
                <Button
                  variant="secondary"
                  size="lg"
                  onClick={onEnterAsPlayer}
                  disabled={iAmDealer || (isRoomFull && !iAmInRoom)
                    < Button
                variant="secondary"
                  size="lg"
                  onClick={onEnterAsPlayer}
                  disabled={iAmDealer}
                >
                  プレイヤーとして開始
                </Button>
              </div>

              <div className="mt-3 text-center text-muted small">
                ディーラーはお題の抽選とゲーム進行を担当します
              </div>
          </Card.Body>
        </Card>
      </div>
    </Container>
  );
};
