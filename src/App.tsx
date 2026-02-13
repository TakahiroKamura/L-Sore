import 'bootstrap/dist/css/bootstrap.min.css';
import { useEffect, useState } from 'react';
import { DealerView } from './components/DealerView';
import { PlayerView } from './components/PlayerView';
import { RoomLobby } from './components/RoomLobby';
import { RoomLogin } from './components/RoomLogin';
import { MAX_PLAYERS } from './constants/game';
import { supabase } from './lib/supabase';

type AppState = 'login' | 'lobby' | 'dealer' | 'player';

function App() {
  const [appState, setAppState] = useState<AppState>('login');
  const [roomId, setRoomId] = useState<string>('');
  const [userName, setUserNameState] = useState<string>('');

  // ページ離脱時の処理（ゴースト対策）
  useEffect(() => {
    const handleBeforeUnload = async () => {
      if (roomId && (appState === 'dealer' || appState === 'player' || appState === 'lobby')) {
        // 非同期だが、ブラウザはある程度待ってくれる
        await supabase
          .from('lsore_players')
          .update({ is_active: false } as any)
          .eq('room_id', roomId)
          .eq('user_id', userName);
        console.log('[App] ページ離脱: プレイヤーを非アクティブ化');
      }
    };

    // beforeunloadイベントを登録
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [roomId, appState, userName]);

  const handleJoinRoom = async (
    roomPassword: string,
    name: string,
    role: 'dealer' | 'player'
  ) => {
    // ユーザー名を設定（これがuserIdにもなる）
    setUserNameState(name);

    // ルームの存在確認
    const { data: room, error } = await supabase
      .from('lsore_rooms')
      .select('id, password')
      .eq('password', roomPassword)
      .single();

    if (error || !room) {
      alert('合言葉が正しくありません');
      return;
    }

    setRoomId(room.id);

    // 現在のアクティブプレイヤー数を確認
    const { data: activePlayers, error: playersError } = await supabase
      .from('lsore_players')
      .select('id, user_id')
      .eq('room_id', room.id)
      .eq('is_active', true);

    if (playersError) {
      console.error('プレイヤー数確認エラー:', playersError);
      alert('入室に失敗しました');
      return;
    }

    // 自分が既に参加しているか確認
    const iAmAlreadyIn = activePlayers?.some((p) => p.user_id === name);

    // 自分がまだ参加していなくて、かつ満員の場合は入室拒否
    if (!iAmAlreadyIn && activePlayers && activePlayers.length >= MAX_PLAYERS) {
      alert(`このルームは満員です（最大${MAX_PLAYERS}人）`);
      return;
    }

    // 既存の同一名前のレコードを無効化（ゴースト対策）
    await supabase
      .from('lsore_players')
      .update({ is_active: false } as any)
      .eq('room_id', room.id)
      .eq('user_id', name);

    // プレイヤーとして登録（user_idは名前と同じ）
    const { error: playerError } = await supabase.from('lsore_players').insert({
      room_id: room.id,
      user_id: name,
      user_name: name,
      role: role,
      is_active: true,
    } as any);

    if (playerError) {
      console.error('プレイヤー登録エラー:', playerError);
      alert('入室に失敗しました');
      return;
    }

    console.log('[App] プレイヤー登録成功:', name, role);

    // ロビーへ移動
    setAppState('lobby');
  };

  const handleEnterAsDealer = async () => {
    // ディーラーに更新（user_idはuserNameと同じ）
    await supabase
      .from('lsore_players')
      .update({ role: 'dealer' })
      .eq('room_id', roomId)
      .eq('user_id', userName);

    setAppState('dealer');
  };

  const handleEnterAsPlayer = async () => {
    // プレイヤーに更新（user_idはuserNameと同じ）
    await supabase
      .from('lsore_players')
      .update({ role: 'player' })
      .eq('room_id', roomId)
      .eq('user_id', userName);

    setAppState('player');
  };

  const handleLeaveRoom = async () => {
    // プレイヤーを非アクティブ化（user_idはuserNameと同じ）
    await supabase
      .from('lsore_players')
      .update({ is_active: false })
      .eq('room_id', roomId)
      .eq('user_id', userName);

    setAppState('login');
    setRoomId('');
  };

  return (
    <>
      {appState === 'login' && <RoomLogin onJoinRoom={handleJoinRoom} />}
      {appState === 'lobby' && (
        <RoomLobby
          roomId={roomId}
          userId={userName}
          onEnterAsDealer={handleEnterAsDealer}
          onEnterAsPlayer={handleEnterAsPlayer}
          onLeaveRoom={handleLeaveRoom}
        />
      )}
      {appState === 'dealer' && (
        <DealerView
          roomId={roomId}
          userId={userName}
          userName={userName}
          onLeaveRoom={handleLeaveRoom}
        />
      )}
      {appState === 'player' && (
        <PlayerView
          roomId={roomId}
          userId={userName}
          userName={userName}
          onLeaveRoom={handleLeaveRoom}
        />
      )}
    </>
  );
}

export default App;
