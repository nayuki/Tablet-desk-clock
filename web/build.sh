# 
# Build script for tablet desk clock
# 
# Copyright (c) Project Nayuki
# All rights reserved. Contact Nayuki for licensing.
# https://www.nayuki.io/page/tablet-desk-clock
# 

sass --no-source-map clock.scss clock.css
tsc --strict --target ES2017 clock.ts
