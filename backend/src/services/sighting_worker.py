import asyncio
from datetime import datetime, timezone, timedelta
from sqlalchemy.orm import Session
from src.db.session import SessionLocal
from src.db.models import FaceGroup, SightingLog

class SightingWorker:
    _instance = None

    def __init__(self):
        self.queue = asyncio.Queue()
        self.running = False
        # Memory Cache: { "user_id:label": last_timestamp }
        self.throttle_cache = {}
        self.THROTTLE_SECONDS = 300 # 5 minutes

    @classmethod
    def get_instance(cls):
        if cls._instance is None:
            cls._instance = cls()
        return cls._instance

    async def start(self):
        """Start the background consumer task"""
        self.running = True
        asyncio.create_task(self.consume())
        print("Sighting Worker Started")

    async def stop(self):
        self.running = False

    async def push_sighting(self, user_id: int, label: str):
        """Called by WebSocket to enqueue a detection"""
        await self.queue.put((user_id, label, datetime.now(timezone.utc)))

    async def consume(self):
        while self.running:
            try:
                # Wait for data (non-blocking)
                user_id, label, timestamp = await self.queue.get()

                cache_key = f"{user_id}:{label}"
                last_time = self.throttle_cache.get(cache_key)

                # 1. Throttling Check (In-Memory)
                if last_time and (timestamp - last_time).total_seconds() < self.THROTTLE_SECONDS:
                    self.queue.task_done()
                    continue

                # 2. Update Cache
                self.throttle_cache[cache_key] = timestamp

                # 3. DB Write (Run in thread to not block async loop)
                await asyncio.to_thread(self._persist_sighting, user_id, label, timestamp)

                self.queue.task_done()
            except Exception as e:
                print(f"Worker Error: {e}")

    def _persist_sighting(self, user_id: int, label: str, timestamp: datetime):
        """Synchronous DB operation"""
        db: Session = SessionLocal()
        try:
            # Find Group
            group = db.query(FaceGroup).filter_by(user_id=user_id, name=label).first()
            if group:
                # Log the specific event
                log = SightingLog(face_group_id=group.id, timestamp=timestamp)
                db.add(log)

                # Update the "Last Seen" cache column on the group for quick dashboard stats
                group.last_seen_at = timestamp

                db.commit()
        except Exception as e:
            print(f"DB Error saving sighting: {e}")
            db.rollback()
        finally:
            db.close()

sighting_worker = SightingWorker.get_instance()
