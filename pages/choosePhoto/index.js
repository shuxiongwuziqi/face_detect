// pages/takePhoto/index.js
const blazeface = require('@tensorflow-models/blazeface');

Page({
  data: {
    _modelUrl: 'http://127.0.0.1:8080/model.json',
  },
  _ctx: null,
  async onReady(){ 
    const model = await blazeface.load({modelUrl:this.data._modelUrl}) 
    this._model = model

    this._ctx = wx.createCanvasContext('canvas')
  },
  chooseImage() {
    wx.chooseImage({
      success: res=>{
        console.log(res)
        wx.getImageInfo({ 
          src: res.tempFilePaths[0],
          success: res=>{
            console.log(res)
            this._ctx.drawImage(res.path,0,0,res.width,res.height,0,0,288,352)
            // 人脸检测 一定要作为draw的回调函数 不然wx.canvasGetImageData返回全零
            this._ctx.draw(false,this.detectFace)
          },
          fail: e=>{
            console.log(e)
          }
        })
      },
      fail: e=>{
        console.log(e)
      }
    })
  },
  detectFace(){
    wx.canvasGetImageData({
      canvasId: 'canvas',
      height: 352,
      width: 288,
      x: 0,
      y: 0,
      success: async res=>{
        console.log(res)
        const input = {
          data: new Uint8Array(res.data),
          width: res.width,
          height: res.height
        }
        console.log(input)
        const preds = await this._model.estimateFaces(input);
        console.log(preds)
        this.drawDetectInfo(preds)
      },
      fail: e=>{
        console.log(e)
      }
    })
  },
  drawDetectInfo(res){
    this._ctx.lineWidth = 3
    this._ctx.strokeStyle = 'red'
    this._ctx.fillStyle = 'yellow'
    if(res.length>=1){
      // 绘画人脸预测框
      const start = res[0].topLeft;
      const end = res[0].bottomRight;
      const size = [end[0] - start[0], end[1] - start[1]];      
      this._ctx.strokeRect(start[0], start[1], size[0], size[1]);

      // 绘制人脸关键点
      const landmarks = res[0].landmarks
      for(let i=0;i<6;++i){
        this._ctx.fillRect(landmarks[i][0]-3,landmarks[i][1]-3,6,6)
      }
      this._ctx.draw(true)
    }
  }
})