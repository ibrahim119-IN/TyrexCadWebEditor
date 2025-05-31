$folders = @(
    "TyrexWebCad/public/assets/opencascade",
    "TyrexWebCad/src/core",
    "TyrexWebCad/src/models",
    "TyrexWebCad/src/rendering",
    "TyrexWebCad/src/ui",
    "TyrexWebCad/src/systems",
    "TyrexWebCad/src/commands/specific_commands",
    "TyrexWebCad/src/drawing_tools",
    "TyrexWebCad/src/editing_tools",
    "TyrexWebCad/src/file_io",
    "TyrexWebCad/src/workers",
    "TyrexWebCad/src/styles"
)

$files = @(
    "TyrexWebCad/package.json",
    "TyrexWebCad/tsconfig.json",
    "TyrexWebCad/tsconfig.node.json",
    "TyrexWebCad/vite.config.ts",
    "TyrexWebCad/public/index.html",
    "TyrexWebCad/public/assets/opencascade/opencascade.wasm",
    "TyrexWebCad/public/assets/opencascade/opencascade.js",
    "TyrexWebCad/src/main.ts",
    "TyrexWebCad/src/vite-env.d.ts",
    "TyrexWebCad/src/core/Constants.ts",
    "TyrexWebCad/src/core/CommandManager.ts",
    "TyrexWebCad/src/core/ProjectManager.ts",
    "TyrexWebCad/src/core/GeometryEngine.ts",
    "TyrexWebCad/src/core/CoordinateSystem.ts",
    "TyrexWebCad/src/core/Logger.ts",
    "TyrexWebCad/src/models/GeometricObject.ts",
    "TyrexWebCad/src/models/Point.ts",
    "TyrexWebCad/src/models/Line.ts",
    "TyrexWebCad/src/models/Circle.ts",
    "TyrexWebCad/src/models/Arc.ts",
    "TyrexWebCad/src/models/Polyline.ts",
    "TyrexWebCad/src/models/Solid.ts",
    "TyrexWebCad/src/models/Wall.ts",
    "TyrexWebCad/src/models/BuildingElement.ts",
    "TyrexWebCad/src/models/Layer.ts",
    "TyrexWebCad/src/models/Block.ts",
    "TyrexWebCad/src/rendering/Viewer.ts",
    "TyrexWebCad/src/rendering/SceneManager.ts",
    "TyrexWebCad/src/rendering/CameraControls.ts",
    "TyrexWebCad/src/rendering/MaterialManager.ts",
    "TyrexWebCad/src/ui/index.ts",
    "TyrexWebCad/src/ui/Toolbar.ts",
    "TyrexWebCad/src/ui/InfoBar.ts",
    "TyrexWebCad/src/ui/DimensionLabel.ts",
    "TyrexWebCad/src/ui/PropertyEditor.ts",
    "TyrexWebCad/src/ui/LayerPanel.ts",
    "TyrexWebCad/src/ui/BlockPanel.ts",
    "TyrexWebCad/src/ui/CommandLine.ts",
    "TyrexWebCad/src/ui/ModalManager.ts",
    "TyrexWebCad/src/systems/SnapSystem.ts",
    "TyrexWebCad/src/systems/MeasurementSystem.ts",
    "TyrexWebCad/src/systems/AreaPerimeterSystem.ts",
    "TyrexWebCad/src/systems/LayerSystem.ts",
    "TyrexWebCad/src/systems/ConstraintSystem.ts",
    "TyrexWebCad/src/systems/DimensioningSystem.ts",
    "TyrexWebCad/src/systems/SelectionSystem.ts",
    "TyrexWebCad/src/systems/HistorySystem.ts",
    "TyrexWebCad/src/commands/Command.ts",
    "TyrexWebCad/src/commands/AddObjectCommand.ts",
    "TyrexWebCad/src/commands/ModifyObjectCommand.ts",
    "TyrexWebCad/src/commands/DeleteObjectCommand.ts",
    "TyrexWebCad/src/drawing_tools/AbstractDrawTool.ts",
    "TyrexWebCad/src/drawing_tools/DrawLineTool.ts",
    "TyrexWebCad/src/drawing_tools/DrawCircleTool.ts",
    "TyrexWebCad/src/drawing_tools/DrawArcTool.ts",
    "TyrexWebCad/src/editing_tools/AbstractEditTool.ts",
    "TyrexWebCad/src/editing_tools/MoveTool.ts",
    "TyrexWebCad/src/editing_tools/TrimTool.ts",
    "TyrexWebCad/src/file_io/IFileParser.ts",
    "TyrexWebCad/src/file_io/JSONSerializer.ts",
    "TyrexWebCad/src/file_io/STEPHandler.ts",
    "TyrexWebCad/src/file_io/IGESHandler.ts",
    "TyrexWebCad/src/workers/opencascade.worker.ts",
    "TyrexWebCad/src/styles/main.css"
)

# إنشاء المجلدات
foreach ($folder in $folders) {
    New-Item -ItemType Directory -Path $folder -Force | Out-Null
}

# إنشاء الملفات
foreach ($file in $files) {
    New-Item -ItemType File -Path $file -Force | Out-Null
}

Write-Host "✅ مشروع TyrexWebCad تم إنشاؤه بنجاح." -ForegroundColor Green
