override val reactNativeHost: ReactNativeHost = object : DefaultReactNativeHost(this) {
    override fun getPackages(): List<ReactPackage> {
        val packages = PackageList(this).packages.toMutableList()
        // Add our custom package
        packages.add(BuildConfigPackage())
        return packages
    }

    override fun getJSMainModuleName(): String = "index"
} 