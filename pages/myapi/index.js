import * as blazeface from "../../model/index"
Page({
  _modelUrl:"http://127.0.0.1:8080/model.json",
  _testImageUrl:"http://127.0.0.1:8080/test.jpg",
  _model: null,
  async onReady(){
    const model = await blazeface.load({modelUrl:this._modelUrl})
    console.log(model)
    this._model = model
    wx.getImageInfo({
      src: this._testImageUrl,
      success: res=>{
        const ctx = wx.createCanvasContext('canvas')
        ctx.drawImage(res.path,0,0,res.width,res.height,0,0,288,352)
        ctx.draw(true,this.detectFace)
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
        const preds = await this._model.estimateFaces(new Uint8Array(res.data),res.width,res.height);
        console.log(preds)
        this.drawDetectInfo(preds)
      }
    })
  },
  drawDetectInfo(res){
    const ctx = wx.createCanvasContext('canvas')
    ctx.lineWidth = 3
    ctx.strokeStyle = 'red'
    ctx.fillStyle = 'yellow'
    if(res.length>=1){
      // 绘画人脸预测框
      const start = res[0].topLeft;
      const end = res[0].bottomRight;
      const size = [end[0] - start[0], end[1] - start[1]];      
      ctx.strokeRect(start[0], start[1], size[0], size[1]);

      // 绘制人脸关键点
      const landmarks = res[0].landmarks
      for(let i=0;i<6;++i){
        ctx.fillRect(landmarks[i][0]-3,landmarks[i][1]-3,6,6)
      }
      ctx.draw(true)
    }
  }
})