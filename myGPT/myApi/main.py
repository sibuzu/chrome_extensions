from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import uvicorn
import os
import aiohttp
import asyncio
import logging
from datetime import datetime
from logging.handlers import RotatingFileHandler

app = FastAPI()

# 設定目錄路徑
BASE_DIR = os.path.dirname(__file__)
IMAGE_PATH = os.path.join(BASE_DIR, "images")
LOG_PATH = os.path.join(BASE_DIR, "log")

# 確保必要的目錄存在
os.makedirs(IMAGE_PATH, exist_ok=True)
os.makedirs(LOG_PATH, exist_ok=True)

# 配置日誌
log_file = os.path.join(LOG_PATH, f"api_{datetime.now().strftime('%Y%m%d')}.log")
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        RotatingFileHandler(
            log_file,
            maxBytes=10*1024*1024,  # 10MB
            backupCount=5
        ),
        logging.StreamHandler()  # 同時輸出到控制台
    ]
)
logger = logging.getLogger(__name__)

# 添加 CORS 中間件
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 在生產環境中應該設置具體的域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 定義數據模型
class Turn(BaseModel):
    id: str
    url: str

class ImageDownloadRequest(BaseModel):
    pageId: str
    turns: List[Turn]

async def download_image(session: aiohttp.ClientSession, url: str, filepath: str) -> bool:
    try:
        async with session.get(url) as response:
            if response.status == 200:
                with open(filepath, 'wb') as f:
                    f.write(await response.read())
                return True
    except Exception as e:
        logger.error(f"Error downloading {url}: {e}")
    return False

@app.post("/images/download")
async def download_images(request: ImageDownloadRequest):
    logger.info(f"Received download request for PageID: {request.pageId}")
    logger.info("Processing turns:")
    
    download_count = 0
    list_count = len(request.turns)
    
    async with aiohttp.ClientSession() as session:
        for turn in request.turns:
            logger.info(f"Processing Turn {turn.id}: {turn.url}")
            
            # 構建圖片文件名
            image_filename = f"{request.pageId}-{int(turn.id):03d}.png"
            image_path = os.path.join(IMAGE_PATH, image_filename)
            
            # 檢查文件是否已存在
            if os.path.exists(image_path):
                logger.info(f"Image {image_filename} already exists, skipping...")
                continue
            
            # 下載圖片
            if await download_image(session, turn.url, image_path):
                download_count += 1
                logger.info(f"Successfully downloaded {image_filename}")
            else:
                logger.error(f"Failed to download {image_filename}")
    
    result = f"finish download {download_count}/{list_count} images"
    logger.info(result)
    return result

if __name__ == "__main__":
    logger.info("Starting API server...")
    uvicorn.run(app, host="0.0.0.0", port=12345)
