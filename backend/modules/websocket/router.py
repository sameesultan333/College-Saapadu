from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from websocket_manager import manager

router = APIRouter(tags=["WebSocket"])


@router.websocket("/ws/canteen/{canteen_id}")
async def websocket_endpoint(websocket: WebSocket, canteen_id: int):
    await manager.connect(canteen_id, websocket)

    try:
        while True:
            await websocket.receive_text()

    except WebSocketDisconnect:
        manager.disconnect(canteen_id, websocket)

