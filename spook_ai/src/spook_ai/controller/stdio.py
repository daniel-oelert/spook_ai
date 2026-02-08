import asyncio
import sys
from datetime import datetime

class StdIOController:
    """Handler for asynchronous stdin/stdout operations."""
    
    def __init__(self):
        self.input_queue = asyncio.Queue()
        self.output_queue = asyncio.Queue()
        self.running = True
    
    async def stdin_reader(self):
        """Read from stdin and queue messages."""
        loop = asyncio.get_event_loop()
        reader = asyncio.StreamReader(limit=100000000)
        protocol = asyncio.StreamReaderProtocol(reader)
        await loop.connect_read_pipe(lambda: protocol, sys.stdin)
        
        while self.running:
            try:
                line = await reader.readline()
                if not line:
                    self.running = False
                    break
                
                message = line.decode().strip()
                if message:
                    await self.input_queue.put(message)
            except Exception as e:
                print(f"Error reading: {e}", file=sys.stderr)
                self.running = False
                break
    
    async def stdout_writer(self):
        """Write queued messages to stdout."""
        while self.running or not self.output_queue.empty():
            try:
                message = await asyncio.wait_for(
                    self.output_queue.get(), 
                    timeout=0.1
                )
                sys.stdout.write(f"{message}\n")
                sys.stdout.flush()
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"Error writing: {e}", file=sys.stderr)
                break
    
    async def message_processor(self):
        """Process incoming messages."""
        while self.running or not self.input_queue.empty():
            try:
                message = await asyncio.wait_for(
                    self.input_queue.get(),
                    timeout=0.1
                )
                
                # Process the message (example: echo with timestamp)
                timestamp = datetime.now().strftime("%H:%M:%S")
                response = f"[{timestamp}] Echo: {message}"
                await self.output_queue.put(response)
                
                # Example: Handle special commands
                if message.lower() == "quit":
                    self.running = False
                    await self.output_queue.put("Shutting down...")
                elif message.lower() == "status":
                    status = f"Queue sizes - Input: {self.input_queue.qsize()}, Output: {self.output_queue.qsize()}"
                    await self.output_queue.put(status)
                    
            except asyncio.TimeoutError:
                continue
            except Exception as e:
                print(f"Error processing: {e}", file=sys.stderr)
                break
    
    async def background_task(self):
        """Optional background task that generates output independently."""
        count = 0
        while self.running:
            await asyncio.sleep(10)
            if self.running:
                await self.output_queue.put(f"[Background] Task iteration {count}")
                count += 1
    
    async def run(self):
        """Run all async tasks concurrently."""
        tasks = [
            asyncio.create_task(self.stdin_reader()),
            asyncio.create_task(self.stdout_writer()),
            asyncio.create_task(self.message_processor()),
            # Uncomment to enable background task:
            # asyncio.create_task(self.background_task()),
        ]
        
        # Wait for all tasks to complete
        await asyncio.gather(*tasks, return_exceptions=True)


    async def async_main(self):
        """Async main entry point."""
        
        # Send initial message
        await self.output_queue.put("Async I/O Handler Started")
        await self.output_queue.put("Type messages and press Enter (type 'quit' to exit)")
        
        await self.run()


    def run(self):
        try:
            asyncio.run(self.async_main())
        except KeyboardInterrupt:
            print("\nInterrupted", file=sys.stderr)
            sys.exit(0)