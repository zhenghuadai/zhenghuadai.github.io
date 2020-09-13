# 深入UEFI内核
前面通过《UEFI原理与编程》一书介绍了如何使用UEFI编写应用程序和驱动，编程一书是从上层应用和驱动开发者的角度认识UEFI的，UEFI就像一个黑盒子，书中详细介绍了这个黑盒子的表面（即UEFI提供给上层开发者的接口和服务）。接口通过Protocol呈现给开发者。主要的Protocol包括控制台输入输出Protocol；文件及硬盘Protocol；操作外部设备的Protocol（PciIo等）；驱动框架Protocol；人机交互接口Protocol；网络Protocol。服务通过启动服务和运行时服务提供，主要包括Protocol服务，内存管理服务，事件管理服务等。UEFI虽然庞大，但它通过模块化被很清晰的组织在一起，当逐步掌握了这些主要的Protocol和服务之后，UEFI也就变得简单起来，那么是时候深入到这个盒子内部，了解UEFI内核的运行机制了。
下面将以系统启动过程为主线介绍UEFI内核。
## 第一条指令（ResetVector）
先说结论：X86 CPU启动后，将从地址0xFFFFFFF0处开始执行（此地址并非内存地址。此时，内存还远远没有初始化。）。这一章来看X86系统是如何实现这一点的。
加电或者RESET针脚被激发（Assert）后[ref intel] CPU会经历如下几个过程:
1. CPU首先会进行硬件初始化（hardware reset）。
2. 然后是可选的自检过程（BIST built-in self-test）。
3. CPU开始执行第一条指令。从此开始CPU进入软件初始化过程。
### 初始化概述
#### 1.CPU硬件初始化
CPU硬件初始化完成后，CPU被设置为实地址模式，地址无分页。所有寄存器被初始化为特定的值， Cache、TLB（Translation Lookup Table）、BLB（Branch Target Buffer）这三个部件的内容被清空（Invalidate）。
#### 2.自检
CPU硬件初始化过程中，硬件可能请求执行自检。如果执行自检，自检完成后，EAX的值为自检错误码，0表示没有任何错误；
#### 3.第一条指令
现在，完事俱备，CPU已经准备好，迫不及待地要执行第一条指令了。且慢，这是一个重要的时刻，此刻决定了CPU能否正常指令，让我们详细了解一下CPU目前的状态。
表1-1 CPU初始化后的寄存器（部分）

|Register|Pentium 4 and Intel Xeon  Processor|P6 Family Processor Including DisplayFamily = 06H)|Pentium Processor|
|----|----|----|----|
|EFLAGS1 |00000002H |00000002H |00000002H|
|EIP |0000FFF0H |0000FFF0H |0000FFF0H|
|CR0 |60000010H |60000010H |60000010H |
|CR2, CR3, CR4 |00000000H |00000000H |00000000H|
|CS |Selector = F000H <br>Base = FFFF0000H <br>Limit = FFFFH <br>AR = Present, R/W, Accessed | Selector = F000H<br> Base = FFF0000H<br> Limit = FFFFH<br> AR = Present, R/W, Accessed | Selector = F000H<br> Base = FFFF0000H<br> Limit = FFFFH<br> AR = Present, R/W, Accessed |
|SS, DS, ES, FS, GS | Selector = 0000H<br> Base = 00000000H<br> Limit = FFFFH<br> AR = Present, R/W, Accessed | Selector = 0000H<br> Base = 00000000H <br>Limit = FFFFH<br> AR = Present, R/W, Accessed | Selector = 0000H<br> Base = 00000000H<br> Limit = FFFFH<br> AR = Present, R/W, Accessed|
|EDX |00000FxxH |000n06xxH |000005xxH|
|EAX |0 |0 |0|
|EBX, ECX, ESI, EDI, EBP,ESP |00000000H |00000000H |00000000H|

此处我们最关心的是指令执行相关的两个寄存器EIP（Instruction Pointer）、CS（Code Segment）。
在实地址模式下（寄存器字长为16位），指令的物理地址是CS << 4 + EIP。段寄存器CS左移四位作为基址，再加上作为偏移的EIP，最终形成指令的物理地址。现代CPU中为了加速指令地址的计算，为每个段寄存器增加了两个寄存器：Base和Limit。Base存放基址，Limit存放最大偏移值。Base和Limit寄存器不能通过指令直接读写，他们的值是在写段寄存器时由CPU自动设置的。通常Base等于段寄存器左移四位，如果CS的值为0xF000，CS的Base寄存器则为0xF0000，但CPU初始化时例外。从表1-1可以看出CS的值为0xF000, 但其Base为0xFFFF0000，EIP为0xFFF0,此时对应的指令地址为0xFFFF0000+0xFFF0 = 0xFFFFFFF0。0xFFFFFFF0就是CPU将要执行的第一条指令。这造成这样一个有趣的事实，16位程序眼中的指令地址空间0x0000~0xFFFF（大小为64K）被CPU翻译到物理地址空间(0xFFFF0000~0xFFFFFFFF)。也就是说，从CPU初始化，到段寄存器被重写（通过跨段跳转指令）前，指令空间0x0000~0xFFFF通过段寄存器被映射到物理地址空间0xFFFF0000~0xFFFFFFFF。
前面讲到第一条指令地址为0xFFFFFFF0，X86系统初始化时会将ROM中的固件映射的（0xFFFFFFFF-固件大小）～0xFFFFFFFF的地址空间。故而0xFFFFFFF0对应ROM中的某条指令，无论ROM中存放的是传统的BIOS固件，还是存放的UEFI固件，这个规则都是一样的。下面将从这天指令开始继续CPU初始化之旅。
### .fdf文件
开始讲0xFFFFFFF0对应的指令之前，还要熟悉UEFI ROM的的结构。
ROM固件（Flash Device binary image）由一个或多个Firmware volume（FV）构成，每个FV里存放了FFS Image（EFI Firmware File system），FFS Image则由多个EFI Section构成，EFI Section包含了PE32/PE32+/Coff Image文件。
欲熟悉UEFI ROM的结构，先来看.fdf文件的格式。.fdf(Flash Description File)用于生成固件镜像，它由[Defines]、[FD]、[FV]等几个部分组成。
#### [Defines]
在[Defines]部分可以通过DEFINE定义本文件将要用到的宏，通过SET定义PCD的值。例如OvmfPkg的OvmfPkgX64.fdf文件的[Defines]为
```c
    [Defines]
    !if $(TARGET) == RELEASE
    !ifndef $(FD_SIZE_2MB)
    DEFINE FD_SIZE_1MB=
    !endif
    !endif
    
    !include OvmfPkg.fdf.inc
```
!ifdef, !ifndef, !if, !elseif, !else and !endif 用于编写条件语句。$(TARGET)是EDK预定义的宏，其值为build命令-b选项的值。可以看出，编译Release版本时，通过DEFINE定义了FD_SIZE_1MB宏。
然后通过！include包含了OvmfPkg.fdf.inc文件，OvmfPkg.fdf.inc内容如下
```c
    DEFINE BLOCK_SIZE        = 0x1000
    DEFINE VARS_SIZE         = 0x20000
    DEFINE VARS_BLOCKS       = 0x20
    
    !ifdef $(FD_SIZE_1MB)
    
    DEFINE FW_BASE_ADDRESS   = 0xFFF00000
    DEFINE FW_SIZE           = 0x00100000
    DEFINE FW_BLOCKS         = 0x100
    DEFINE CODE_BASE_ADDRESS = 0xFFF20000
    DEFINE CODE_SIZE         = 0x000E0000
    DEFINE CODE_BLOCKS       = 0xE0
    DEFINE FVMAIN_SIZE       = 0x000CC000
    DEFINE SECFV_OFFSET      = 0x000EC000
    DEFINE SECFV_SIZE        = 0x14000
    
    !else
    
    DEFINE FW_BASE_ADDRESS   = 0xFFE00000
    DEFINE FW_SIZE           = 0x00200000
    DEFINE FW_BLOCKS         = 0x200
    DEFINE CODE_BASE_ADDRESS = 0xFFE20000
    DEFINE CODE_SIZE         = 0x001E0000
    DEFINE CODE_BLOCKS       = 0x1E0
    DEFINE FVMAIN_SIZE       = 0x001AC000
    DEFINE SECFV_OFFSET      = 0x001CC000
    DEFINE SECFV_SIZE        = 0x34000
    
    !endif
    
    SET gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFdBaseAddress     = $(FW_BASE_ADDRESS)
    SET gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFirmwareFdSize    = $(FW_SIZE)
    SET gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFirmwareBlockSize = $(BLOCK_SIZE)
    
    SET gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFlashNvStorageVariableBase = $(FW_BASE_ADDRESS)
    SET gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageVariableSize = 0xE000
    
    SET gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFlashNvStorageEventLogBase = gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFlashNvStorageVariableBase + gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageVariableSize
    SET gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFlashNvStorageEventLogSize = $(BLOCK_SIZE)
    
    SET gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFlashNvStorageFtwWorkingBase = gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFlashNvStorageEventLogBase + gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFlashNvStorageEventLogSize
    SET gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageFtwWorkingSize = $(BLOCK_SIZE)
    
    SET gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFlashNvStorageFtwSpareBase = gUefiOvmfPkgTokenSpaceGuid.PcdOvmfFlashNvStorageFtwWorkingBase + gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageFtwWorkingSize
    SET gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageFtwSpareSize = 0x1000
```
通过OvmfPkg.fdf.inc可以看出，编译RELEASE版本的OVMF时， FW_BASE_ADDRESS（固件基址）被定义为0xFFF00000， FW_SIZE被定义为0x00100000（1 M）。

#### [FD]
每个[FD]定义一个flash device image。flash device image可以是一个移动介质的可启动Image，或者系统ROM Image，也可以是用于更新系统ROM的Update("Capsule") Image。
每个.inf文件可以有多个[FD],每个[FD]生成一个.fd镜像文件。例如OvmfPkgX64.fdf文件定义了[FD.OVMF]、[FD.OVMF_VARS]、[FD.OVMF_CODE]、[FD.MEMFD]，编译后会生成OVMF.FD、OVMF_VARS.FD、OVMF_CODE.FD、MEMFD.FD四个镜像文件。
##### TOKEN
[FD]块以TOKEN语句开始，用于定义本FD的基本属性，每一行定义一个Token，基本语法如下：
```C
Token = VALUE [| PcdName]
```
有效的Token包括以下5个

|Token | 用途 |
|--- | ---|
|BaseAddress| FLASH Device的基址|
|Size|FLASH Device的大小|
|ErasePolarity||
|BlockSize||
|NumBlocks|默认值为1|
BlockSize可以出现多次，$\sum_{i=0}^{n} BlockSize_i * NumBlocks_i$必须等于Size。
例如Nt32PKG.fdf文件中
```C
[FD.Nt32]
BaseAddress   = 0x0|gEfiNt32PkgTokenSpaceGuid.PcdWinNtFdBaseAddress  
Size          = 0x002a0000 
ErasePolarity = 1
BlockSize     = 0x10000
NumBlocks     = 0x2a
```
NT32PKG生成的NT32.fd基址为0，在程序中可以通过PCD的gEfiNt32PkgTokenSpaceGuid.PcdWinNtFdBaseAddress访问这个值。大小为0x002a0000 = 0x10000 * 0x2a。
再如下例，Size(0x102000) = 0x10000 * 16  + 0x1000 * 2
```C
[FD.FdMain]
BaseAddress = 0xFFF00000 | \
gEfiMyPlatformTokenSpaceGuid.PcdFlashAreaBaseAddress
Size = 0x102000
ErasePolarity = 1
BlockSize = 0x10000
NumBlocks = 16
BlockSize = 0x1000
NumBlocks = 2
```
接着Token的是可选的DEFINE和SET定义，用于定义本[FD]块内有效的宏和PCD。
然后是Region列表，每个Region定义了位置、大小及其中的内容，格式为
```C
Offset|Size
[TokenSpaceGuidCName.PcdOffsetCName|TokenSpaceGuidCName.PcdSizeCName]?
[RegionType]?
```
第一行定义了本Region的偏移位置和大小。
第二行和第三行为可选项。
第二行定义对应的PCD值，相当于
SET TokenSpaceGuidCName.PcdOffsetCName = Offset
SET TokenSpaceGuidCName.PcdSizeCName = Size
第三行定义本Region包含的内容。内容可以为数据（Data），也可以是FV（Firmware Volume）。
所有的Region必须按偏移地址升序排列，Region之间不得重叠。
例如OvmfPkg.fdf.inc文件的[FD.OVMF]块：
```C
[FD.OVMF]
BaseAddress   = $(FW_BASE_ADDRESS)
Size          = $(FW_SIZE)
ErasePolarity = 1
BlockSize     = $(BLOCK_SIZE)
NumBlocks     = $(FW_BLOCKS)

!include VarStore.fdf.inc

$(VARS_SIZE)|$(FVMAIN_SIZE)
FV = FVMAIN_COMPACT

$(SECFV_OFFSET)|$(SECFV_SIZE)
FV = SECFV
```
通过！include VarStore.fdf.inc引入了数据Region，数据Reigon后是两个Fv。编译Release版本OVMF时，这两个Region为
```C
0x20000|0x000CC000
FV = FVMAIN_COMPACT

0x000EC000|0x14000
FV = SECFV
```
1M的ovmf.fd内容组织如下：

|地址区间| 内容|
|--|--|
|0x00000 ~ 0x01FFFF| Data|
|0x20000 ~ 0x0EBFFF| FVMAIN_COMPACT|
|0xEC000 ~ 0x100000| SECFV|
再来看OVMF.FD的数据区，定义在文件VarStore.fdf.inc中,详细大家已经掌握了其格式。
```C
0x00000000|0x0000e000
#NV_VARIABLE_STORE
DATA = {
  ## This is the EFI_FIRMWARE_VOLUME_HEADER
  # ZeroVector []
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  # FileSystemGuid: gEfiSystemNvDataFvGuid         =
  #   { 0xFFF12B8D, 0x7696, 0x4C8B,
  #     { 0xA9, 0x85, 0x27, 0x47, 0x07, 0x5B, 0x4F, 0x50 }}
  0x8D, 0x2B, 0xF1, 0xFF, 0x96, 0x76, 0x8B, 0x4C,
  0xA9, 0x85, 0x27, 0x47, 0x07, 0x5B, 0x4F, 0x50,
  # FvLength: 0x20000
  0x00, 0x00, 0x02, 0x00, 0x00, 0x00, 0x00, 0x00,
  # Signature "_FVH"       # Attributes
  0x5f, 0x46, 0x56, 0x48, 0xff, 0xfe, 0x04, 0x00,
  # HeaderLength # CheckSum # ExtHeaderOffset #Reserved #Revision
  0x48, 0x00, 0x19, 0xF9, 0x00, 0x00, 0x00, 0x02,
  # Blockmap[0]: 0x20 Blocks * 0x1000 Bytes / Block
  0x20, 0x00, 0x00, 0x00, 0x00, 0x10, 0x00, 0x00,
  # Blockmap[1]: End
  0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00,
  ## This is the VARIABLE_STORE_HEADER
!if $(SECURE_BOOT_ENABLE) == TRUE
  # Signature: gEfiAuthenticatedVariableGuid =
  #   { 0xaaf32c78, 0x947b, 0x439a,
  #     { 0xa1, 0x80, 0x2e, 0x14, 0x4e, 0xc3, 0x77, 0x92 }}
  0x78, 0x2c, 0xf3, 0xaa, 0x7b, 0x94, 0x9a, 0x43,
  0xa1, 0x80, 0x2e, 0x14, 0x4e, 0xc3, 0x77, 0x92,
!else
  # Signature: gEfiVariableGuid =
  #   { 0xddcf3616, 0x3275, 0x4164,
  #     { 0x98, 0xb6, 0xfe, 0x85, 0x70, 0x7f, 0xfe, 0x7d }}
  0x16, 0x36, 0xcf, 0xdd, 0x75, 0x32, 0x64, 0x41,
  0x98, 0xb6, 0xfe, 0x85, 0x70, 0x7f, 0xfe, 0x7d,
!endif
  # Size: 0xe000 (gEfiMdeModulePkgTokenSpaceGuid.PcdFlashNvStorageVariableSize) -
  #         0x48 (size of EFI_FIRMWARE_VOLUME_HEADER) = 0xdfb8
  # This can speed up the Variable Dispatch a bit.
  0xB8, 0xDF, 0x00, 0x00,
  # FORMATTED: 0x5A #HEALTHY: 0xFE #Reserved: UINT16 #Reserved1: UINT32
  0x5A, 0xFE, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
}

0x0000e000|0x00001000
#NV_EVENT_LOG

0x0000f000|0x00001000
#NV_FTW_WORKING
DATA = {
  # EFI_FAULT_TOLERANT_WORKING_BLOCK_HEADER->Signature = gEdkiiWorkingBlockSignatureGuid         =
  #  { 0x9e58292b, 0x7c68, 0x497d, { 0xa0, 0xce, 0x65,  0x0, 0xfd, 0x9f, 0x1b, 0x95 }}
  0x2b, 0x29, 0x58, 0x9e, 0x68, 0x7c, 0x7d, 0x49,
  0xa0, 0xce, 0x65,  0x0, 0xfd, 0x9f, 0x1b, 0x95,
  # Crc:UINT32            #WorkingBlockValid:1, WorkingBlockInvalid:1, Reserved
  0x2c, 0xaf, 0x2c, 0x64, 0xFE, 0xFF, 0xFF, 0xFF,
  # WriteQueueSize: UINT64
  0xE0, 0x0F, 0x00, 0x00, 0x00, 0x00, 0x00, 0x00
}

0x00010000|0x00010000
#NV_FTW_SPAR
```
#### [FV]
下面来看在FD中作为Region的FV(Firmare Volume)。一个FV定义了一个固件卷，其内容包含一些列二进制Image，这些Image按[FV]中排列的顺序排列在最终生成固件中。
[FV.UiFvName]中UiFvName用于标示这个FV，通过 FV = UiFvName可以在其他FV和FD中引用UiFvName。
先睹为快，下面是[FV.SECFV]
```C
[FV.SECFV]
BlockSize          = 0x1000
FvAlignment        = 16
ERASE_POLARITY     = 1
MEMORY_MAPPED      = TRUE
STICKY_WRITE       = TRUE
LOCK_CAP           = TRUE
LOCK_STATUS        = TRUE
WRITE_DISABLED_CAP = TRUE
WRITE_ENABLED_CAP  = TRUE
WRITE_STATUS       = TRUE
WRITE_LOCK_CAP     = TRUE
WRITE_LOCK_STATUS  = TRUE
READ_DISABLED_CAP  = TRUE
READ_ENABLED_CAP   = TRUE
READ_STATUS        = TRUE
READ_LOCK_CAP      = TRUE
READ_LOCK_STATUS   = TRUE

#
# SEC Phase modules
#
INF  OvmfPkg/Sec/SecMain.inf
INF  RuleOverride=RESET_VECTOR OvmfPkg/ResetVector/ResetVector.inf

```
[FV]首先是Token，定义了本FV的基本属性，例如BlockSize等。
然后可以通过DEFINE 定义宏，通过SET定义PCD。
在然后就是内容列表了。内容可以通过INF、FILE定义，也可以通过SECTION、APRIORI包含一系列内容。
##### INF
通过INF包含一个模块，其语法如下
```C
INF [Options] PathAndInfFileName
```
例如【FV.SECFV]中，通过INF 定义了SecMain.inf、ResetVector.inf，这两个模块将会按顺序存放在这个FV中。编译ResetVector.inf模块时将会按RESET_VECTOR指定的规则生成.efi文件。

##### FILE
通过FILE包含文件的语法有两种，一种是包含单个文件，一种表示包含多个文件
```C
FILE Type $(NAMED_GUID) [Options] FileName
或者
FILE Type = $(NAMED_GUID) [Options] {
SECTION SECTION_TYPE = FileName
SECTION SECTION_TYPE = FileName
}
```
例如[FV.DXEFV]有如下内容。
```C
#Type为FREEFORM，表示二进制内容。
FILE FREEFORM = PCD(gEfiIntelFrameworkModulePkgTokenSpaceGuid.PcdLogoFile) {
  SECTION RAW = MdeModulePkg/Logo/Logo.bmp
}

FILE DRIVER = 5D695E11-9B3F-4b83-B25F-4A8D5D69BE07 {
  SECTION PE32 = Intel3.5/EFIX64/E3507X2.EFI
 }
```
可用的Type包括：

|TYPE||
|--|--|
|RAW||
|FREEFORM||
|SEC||
|PEI_CORE||
|DXE_CORE||
|PEIM||
|DRIVER||
|COMBO_PEIM_DRIVER||
|SMM_CORE||
|DXE_SMM_DRIVER||
|APPLICATION||
|FV_IMAGE||
|DISPOSABLE||
|0x00~0xFF||

### OVMF.FD
通过分析[FD.OVMF]及[FV.SECFV]可以知道，在生成的OVMF.FD文件中位于文件最后的是ResetVector.inf模块。OVMF.FD可以烧到系统ROM中作为系统固件。前面已经讲过开机时ROM将被映射到0xFFFFFFFF最靠后的内存中。那么第一条指令对应地址0xFFFFFFF0将位于ResetVector.inf模块。
ResetVector.inf内容如下：
```
[Defines]
  INF_VERSION                    = 0x00010005
  BASE_NAME                      = ResetVector
  FILE_GUID                      = 1BA0062E-C779-4582-8566-336AE8F78F09
  MODULE_TYPE                    = SEC
  VERSION_STRING                 = 1.1

[Sources]
  ResetVector.nasmb

[Packages]
  MdePkg/MdePkg.dec
  UefiCpuPkg/UefiCpuPkg.dec

[BuildOptions]
   *_*_IA32_NASMB_FLAGS = -I$(WORKSPACE)/UefiCpuPkg/ResetVector/Vtf0/
   *_*_X64_NASMB_FLAGS = -I$(WORKSPACE)/UefiCpuPkg/ResetVector/Vtf0/
```
ResetVector.inf包含了源文件ResetVector.nasmb，内容如下：
```
%ifndef ARCH_IA32
  %ifndef ARCH_X64
    #include <Base.h>
    #if defined (MDE_CPU_IA32)
      %define ARCH_IA32
    #elif defined (MDE_CPU_X64)
      %define ARCH_X64
    #endif
  %endif
%endif

%ifdef ARCH_IA32
  %ifdef ARCH_X64
    %error "Only one of ARCH_IA32 or ARCH_X64 can be defined."
  %endif
%elifdef ARCH_X64
%else
  %error "Either ARCH_IA32 or ARCH_X64 must be defined."
%endif

%include "CommonMacros.inc"

%include "PostCodes.inc"

%ifdef DEBUG_PORT80
  %include "Port80Debug.asm"
%elifdef DEBUG_SERIAL
  %include "SerialDebug.asm"
%else
  %include "DebugDisabled.asm"
%endif

%include "Ia32/SearchForBfvBase.asm"
%include "Ia32/SearchForSecEntry.asm"

%ifdef ARCH_X64
%include "Ia32/Flat32ToFlat64.asm"
%include "Ia32/PageTables64.asm"
%endif

%include "Ia16/Real16ToFlat32.asm"
%include "Ia16/Init16.asm"

%include "Main.asm"

%include "Ia16/ResetVectorVtf0.asm"

```
位于最后的是ResetVectorVtf0.asm，其内容如下：
```C
BITS    16
ALIGN   16
%ifdef ALIGN_TOP_TO_4K_FOR_PAGING
    TIMES (0x1000 - ($ - EndOfPageTables) - 0x20) DB 0
%endif
applicationProcessorEntryPoint:
    jmp     EarlyApInitReal16
ALIGN   8
    DD      0
vtfSignature:
    DB      'V', 'T', 'F', 0
ALIGN   16
resetVector:
; This is where the processor will begin execution
;
    nop
    nop
    jmp     EarlyBspInitReal16

ALIGN   16
fourGigabytes:
```
位于0xFFFFFFF0（fourGigabytes-16)处的是指标resetVector:，从此处开始的第一条有效指令是 jmp     EarlyBspInitReal16。
可以通过反汇编OVMF.fd验证，
OVMF.FD最后16字节为
```C
0x000FFFF0 90 90 E9 AB FF 90 90 90  90 90 90 90 90 90 90 90
```
指令码90对应的指令正是nop，E9 AB FF对应的指令是 jmp FFAB, 跳转到EIP+(FFAB)处执行， E9 AB FF对应的EIP为0x000FFFF2,那么下一条指令的EIP为0x000FFFF5， FFAB是-0x55, 0x000FFFF5 - 0x55 = 0xFFFA0. 0xFFFA0正是EarlyBspInitReal16。编译后的汇编码位于OvmfX64\RELEASE_VS2010x86\X64\OvmfPkg\ResetVector\ResetVector\OUTPUT\ResetVector.lst文件中。
```C
                       <1> EarlyBspInitReal16:
   BF4250              <1>     mov     di, 'BP'
   EB0B                <1>     jmp     short Main16
```
OVMF.FD中偏移0xFFFA0处的地址码为：
```C
0x00FFFA0 BF 42 50 EB 0B BF 41 50  EB 06 66 89 C4 E9 03 00
```
BF 42 50正是mov di, 'BP'对应的指令码。
再往后就是CPU软件初始化的过程了。

