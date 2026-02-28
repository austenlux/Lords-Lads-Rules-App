# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# react-native-reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# MediaPipe tasks-text pulls in auto-value annotation processors that reference
# javax.lang.model classes only present at compile time — suppress R8 warnings.
-dontwarn javax.lang.model.SourceVersion
-dontwarn javax.lang.model.element.Element
-dontwarn javax.lang.model.element.ElementKind
-dontwarn javax.lang.model.element.Modifier
-dontwarn javax.lang.model.type.TypeMirror
-dontwarn javax.lang.model.type.TypeVisitor
-dontwarn javax.lang.model.util.SimpleTypeVisitor8

# Keep MediaPipe classes used via reflection.
-keep class com.google.mediapipe.** { *; }
-dontwarn com.google.mediapipe.proto.CalculatorProfileProto$CalculatorProfile
-dontwarn com.google.mediapipe.proto.GraphTemplateProto$CalculatorGraphTemplate

# MediaPipe uses protobuf-lite internally and resolves message types by class
# name at runtime. R8 obfuscates protobuf classes (e.g. renames them to "e"),
# which breaks that reflection lookup with:
#   RuntimeException: Unable to get message info for com.google.protobuf.X
# Keep all protobuf generated message classes and the protobuf runtime intact.
-keep class com.google.protobuf.** { *; }
-keep class * extends com.google.protobuf.GeneratedMessageLite { *; }
-keep class * extends com.google.protobuf.GeneratedMessage { *; }
-dontwarn com.google.protobuf.**

# Add any project specific keep options here:
