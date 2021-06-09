# face_detect
##  快速安装

1. npm i 安装所有依赖包。
2. 微信小程序顶部选择： 工具-> 构建npm，注意发生错误但不会影响执行。
3. 编译程序，因为人脸检测api是typescript写的，编译完后，如果不修改api，在微信小程序顶部选择：详情->本地设置->编译前预处理，把npm run tsc删掉，这样去除预处理工作，速度更快。
4. 提供静态服务器为小程序提供blazeface人脸检测模型。**npm install http-server -g** 安装http-server静态服务器，在项目根目录下执行 **hs blazeface_model --cors**命令开启静态服务。
5. 配置地址，pages\fine\config.js文件，修改modelUrl地址。
6. 保证手机和电脑处于同一局域网，微信小程序点击预览即可运行小程序。

## 效果

![f29e9a36130b2ad04b917d729d83a78e](.\showup\f29e9a36130b2ad04b917d729d83a78e.gif)

## TODO

这个项目只展示前端的功能，后端由另外一个仓库提供，可以需要连接后端，在pages\fine\index.js文件中修改faceReconition和onConfirm函数，完成相片的上传和确认。

## 详细介绍

我已经把微信小程序如何安装tensorflow环境，如何解读balzeface api和完善api的工作写在这里了。

 [详细请看这里](https://blog.csdn.net/weixin_40940093/article/details/113932098)