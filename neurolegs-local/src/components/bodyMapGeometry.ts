import type { BodySide, MuscleGroup } from "../types";

export type MuscleRegionPath = {
  id: string;
  side: BodySide;
  group: MuscleGroup;
  label: string;
  d: string;
};

export const BODY_MAP_IMAGE_SIZE = {
  width: 860,
  height: 753,
};

export const BODY_MAP_VIEWBOX: Record<BodySide, { x: number; y: number; width: number; height: number }> = {
  front: { x: 0, y: 80, width: 430, height: 640 },
  back: { x: 430, y: 80, width: 430, height: 640 },
};

// Region coordinates adapted from TrexKalp/Muscle-Map-Vanilla (musclemap2 image map),
// remapped to this app's 8-group model.
export const BODY_MUSCLE_REGIONS: MuscleRegionPath[] = [
  {
    id: "front-bicep-1",
    side: "front",
    group: "biceps",
    label: "bicep",
    d: "M 117 274 L 128 270 L 136 266 L 146 256 L 154 235 L 155 226 L 157 211 L 147 204 L 139 206 L 132 208 L 125 214 L 119 224 L 115 235 L 114 256 L 116 272 Z",
  },
  {
    id: "front-bicep-2",
    side: "front",
    group: "biceps",
    label: "bicep",
    d: "M 320 273 L 324 257 L 323 245 L 321 234 L 318 225 L 316 218 L 310 212 L 304 210 L 296 205 L 290 202 L 281 208 L 281 217 L 282 229 L 283 240 L 287 251 L 292 261 L 304 268 Z",
  },
  {
    id: "front-forearms-1",
    side: "front",
    group: "biceps",
    label: "forearms",
    d: "M 71 339 L 85 350 L 88 344 L 93 336 L 99 327 L 104 321 L 111 314 L 118 308 L 124 303 L 131 295 L 136 287 L 139 279 L 141 267 L 133 268 L 123 273 L 117 274 L 113 262 L 112 254 L 103 262 L 95 275 L 87 298 Z",
  },
  {
    id: "front-forearms-2",
    side: "front",
    group: "biceps",
    label: "forearms",
    d: "M 296 267 L 298 279 L 303 293 L 310 303 L 318 310 L 327 317 L 335 325 L 342 334 L 347 342 L 350 350 L 355 346 L 361 342 L 366 339 L 363 331 L 360 322 L 357 313 L 352 303 L 349 294 L 345 284 L 342 275 L 337 267 L 331 260 L 325 256 L 321 273 Z",
  },
  {
    id: "front-chest-1",
    side: "front",
    group: "chest",
    label: "chest",
    d: "M 149 203 L 153 196 L 158 190 L 162 185 L 165 179 L 170 174 L 174 169 L 180 166 L 186 165 L 191 165 L 196 167 L 201 170 L 206 174 L 212 179 L 214 187 L 215 198 L 216 207 L 215 215 L 208 217 L 201 218 L 194 219 L 187 220 L 180 221 L 173 219 L 162 215 Z",
  },
  {
    id: "front-chest-2",
    side: "front",
    group: "chest",
    label: "chest",
    d: "M 225 181 L 229 175 L 235 170 L 241 167 L 248 163 L 255 163 L 261 168 L 268 174 L 274 183 L 280 192 L 286 199 L 284 207 L 273 215 L 263 220 L 255 222 L 243 221 L 227 217 L 221 214 L 222 203 L 223 191 Z",
  },
  {
    id: "front-delt-1",
    side: "front",
    group: "shoulders",
    label: "delt",
    d: "M 127 207 L 125 195 L 126 183 L 130 174 L 134 166 L 141 160 L 148 156 L 154 156 L 161 155 L 167 155 L 174 156 L 184 161 L 178 165 L 170 171 L 164 180 L 157 191 L 150 200 L 139 206 L 129 212 Z",
  },
  {
    id: "front-delt-2",
    side: "front",
    group: "shoulders",
    label: "delt",
    d: "M 285 157 L 291 160 L 296 162 L 302 165 L 308 171 L 310 182 L 312 191 L 312 202 L 309 211 L 299 207 L 293 202 L 288 203 L 276 184 L 268 173 L 261 166 L 254 163 L 259 156 L 291 160 Z",
  },
  {
    id: "front-trap-1",
    side: "front",
    group: "shoulders",
    label: "trap",
    d: "M 198 126 L 200 133 L 203 142 L 206 149 L 210 157 L 212 164 L 204 160 L 197 159 L 189 157 L 181 156 L 172 155 L 184 149 L 191 145 L 195 138 Z",
  },
  {
    id: "front-trap-2",
    side: "front",
    group: "shoulders",
    label: "trap",
    d: "M 226 165 L 227 156 L 232 148 L 235 139 L 237 132 L 240 123 L 243 140 L 248 147 L 254 152 L 260 153 L 267 156 L 253 157 L 240 159 Z",
  },
  {
    id: "front-quad-1",
    side: "front",
    group: "quads",
    label: "quad",
    d: "M 163 325 L 158 337 L 154 350 L 149 367 L 145 383 L 144 405 L 143 424 L 143 434 L 146 445 L 151 456 L 156 470 L 162 480 L 167 476 L 170 468 L 176 476 L 182 484 L 189 487 L 195 490 L 196 477 L 199 467 L 202 458 L 206 446 L 207 437 L 209 427 L 210 417 L 211 408 L 214 397 L 214 387 L 210 377 L 199 359 L 182 338 Z",
  },
  {
    id: "front-quad-2",
    side: "front",
    group: "quads",
    label: "quad",
    d: "M 242 490 L 242 481 L 237 470 L 234 457 L 232 446 L 229 432 L 228 421 L 227 411 L 225 399 L 223 388 L 226 378 L 230 372 L 235 366 L 240 358 L 246 351 L 252 343 L 259 336 L 265 332 L 272 326 L 276 325 L 281 338 L 284 351 L 287 361 L 290 371 L 291 383 L 293 395 L 293 407 L 295 420 L 294 433 L 292 445 L 287 456 L 283 467 L 275 481 L 268 469 L 258 482 Z",
  },
  {
    id: "front-knee-1",
    side: "front",
    group: "quads",
    label: "knee",
    d: "M 145 443 L 146 450 L 148 460 L 151 469 L 153 478 L 153 493 L 151 512 L 156 508 L 161 504 L 167 507 L 171 515 L 176 517 L 183 519 L 188 521 L 190 514 L 192 506 L 195 499 L 196 491 L 185 486 L 176 474 L 171 466 L 167 478 L 160 478 L 156 466 L 153 459 Z",
  },
  {
    id: "front-knee-2",
    side: "front",
    group: "quads",
    label: "knee",
    d: "M 243 492 L 244 501 L 246 509 L 249 516 L 251 521 L 256 518 L 261 518 L 266 514 L 271 508 L 276 504 L 281 508 L 288 513 L 288 503 L 285 492 L 285 484 L 285 476 L 287 468 L 290 461 L 293 446 L 288 455 L 282 469 L 275 479 L 271 476 L 268 468 L 263 476 L 258 482 L 250 486 Z",
  },
  {
    id: "front-calf-1",
    side: "front",
    group: "calves",
    label: "calf",
    d: "M 162 633 L 158 622 L 155 607 L 152 596 L 150 584 L 150 574 L 149 563 L 149 554 L 149 543 L 149 533 L 149 517 L 146 526 L 144 538 L 143 546 L 140 556 L 140 569 L 138 579 L 139 590 L 142 602 L 143 612 L 146 623 L 147 632 L 149 644 L 144 651 L 141 661 L 137 670 L 133 680 L 127 687 L 126 695 L 132 697 L 139 699 L 144 699 L 149 699 L 154 698 L 161 695 L 163 689 L 164 680 L 167 673 L 171 666 L 167 647 L 167 631 L 167 619 L 170 607 L 175 598 L 179 586 L 182 576 L 185 563 L 186 553 L 186 544 L 188 533 L 188 523 L 183 530 L 178 539 L 173 551 L 169 562 L 167 574 L 165 588 L 164 603 Z",
  },
  {
    id: "front-calf-2",
    side: "front",
    group: "calves",
    label: "calf",
    d: "M 276 634 L 279 625 L 281 615 L 283 604 L 285 593 L 286 581 L 288 568 L 288 556 L 288 545 L 288 534 L 289 516 L 292 534 L 297 551 L 299 565 L 299 578 L 298 588 L 298 601 L 295 612 L 292 623 L 290 635 L 289 646 L 294 655 L 298 665 L 300 673 L 305 680 L 311 686 L 311 694 L 304 695 L 297 696 L 291 697 L 285 697 L 279 695 L 274 689 L 273 678 L 269 671 L 266 663 L 272 643 L 272 626 L 270 614 L 267 606 L 263 599 L 260 591 L 257 583 L 255 574 L 253 565 L 253 556 L 252 548 L 252 539 L 251 525 L 257 535 L 263 548 L 267 562 L 270 575 L 274 593 L 275 609 Z",
  },
  {
    id: "back-trapb-1",
    side: "back",
    group: "back",
    label: "trapb",
    d: "M 597 141 L 609 134 L 617 126 L 626 113 L 632 114 L 637 114 L 642 114 L 649 114 L 654 113 L 657 120 L 662 126 L 669 133 L 674 137 L 682 142 L 670 139 L 654 135 L 641 132 L 632 136 L 620 138 L 609 140 Z",
  },
  {
    id: "back-deltb-1",
    side: "back",
    group: "shoulders",
    label: "deltb",
    d: "M 543 201 L 542 190 L 542 178 L 544 168 L 551 159 L 558 153 L 569 147 L 581 145 L 589 145 L 597 145 L 602 153 L 590 164 L 579 169 L 572 177 L 572 185 L 558 191 L 550 195 Z",
  },
  {
    id: "back-deltb-2",
    side: "back",
    group: "shoulders",
    label: "deltb",
    d: "M 739 201 L 740 187 L 738 172 L 733 162 L 727 155 L 720 150 L 712 145 L 703 144 L 694 143 L 684 144 L 680 150 L 690 160 L 700 168 L 708 171 L 712 180 L 711 184 L 721 188 L 730 193 Z",
  },
  {
    id: "back-upperb-1",
    side: "back",
    group: "back",
    label: "upperb",
    d: "M 641 251 L 635 242 L 631 233 L 625 225 L 621 216 L 617 210 L 614 200 L 613 188 L 612 176 L 610 166 L 605 155 L 598 146 L 605 142 L 612 140 L 620 139 L 626 137 L 634 134 L 641 132 L 648 135 L 656 138 L 663 139 L 672 141 L 677 142 L 683 145 L 677 155 L 671 166 L 670 180 L 668 199 L 664 211 L 654 227 L 647 239 Z",
  },
  {
    id: "back-shoulder-1",
    side: "back",
    group: "shoulders",
    label: "shoulder",
    d: "M 612 201 L 606 201 L 599 206 L 593 209 L 586 209 L 579 207 L 574 202 L 571 194 L 571 186 L 571 178 L 573 172 L 578 169 L 583 167 L 589 164 L 593 159 L 599 152 L 605 156 L 609 166 L 613 177 L 613 189 Z",
  },
  {
    id: "back-shoulder-2",
    side: "back",
    group: "shoulders",
    label: "shoulder",
    d: "M 669 202 L 675 201 L 680 204 L 686 209 L 691 211 L 697 210 L 702 208 L 707 204 L 708 196 L 710 189 L 710 183 L 709 176 L 705 170 L 699 167 L 692 163 L 686 157 L 681 153 L 675 160 L 671 170 L 668 185 Z",
  },
  {
    id: "back-lats-1",
    side: "back",
    group: "back",
    label: "lats",
    d: "M 575 206 L 577 228 L 580 251 L 582 266 L 586 281 L 587 299 L 585 315 L 602 311 L 610 304 L 616 293 L 617 281 L 617 272 L 621 263 L 626 258 L 632 254 L 640 251 L 647 253 L 653 256 L 659 261 L 663 269 L 665 280 L 666 290 L 669 299 L 677 310 L 686 313 L 697 316 L 695 295 L 695 284 L 698 266 L 702 251 L 702 241 L 705 227 L 707 208 L 694 211 L 679 202 L 670 201 L 663 212 L 656 224 L 650 235 L 641 251 L 634 240 L 628 228 L 623 218 L 618 208 L 614 201 L 606 201 L 601 206 L 590 211 Z",
  },
  {
    id: "back-lowerb-1",
    side: "back",
    group: "back",
    label: "lowerb",
    d: "M 605 313 L 612 314 L 618 317 L 624 320 L 630 323 L 634 327 L 640 339 L 645 332 L 650 324 L 656 319 L 663 317 L 669 315 L 676 312 L 671 304 L 666 293 L 664 284 L 664 275 L 662 268 L 658 259 L 651 255 L 645 252 L 637 252 L 628 256 L 622 262 L 616 275 L 616 288 L 614 299 L 609 305 L 605 311 Z",
  },
  {
    id: "back-glutes-1",
    side: "back",
    group: "hamstrings",
    label: "glutes",
    d: "M 585 318 L 580 341 L 574 356 L 571 371 L 577 365 L 578 380 L 581 393 L 588 397 L 595 401 L 605 403 L 613 405 L 622 404 L 635 403 L 636 393 L 641 382 L 644 388 L 646 401 L 653 403 L 665 404 L 677 404 L 687 400 L 694 397 L 701 389 L 704 380 L 704 368 L 710 371 L 707 355 L 703 341 L 700 329 L 697 319 L 685 313 L 679 311 L 673 314 L 664 316 L 652 322 L 646 331 L 641 337 L 632 326 L 621 317 L 609 313 L 595 313 Z",
  },
  {
    id: "back-ham-1",
    side: "back",
    group: "hamstrings",
    label: "ham",
    d: "M 564 505 L 574 500 L 583 520 L 585 511 L 591 521 L 598 536 L 604 526 L 609 511 L 612 498 L 616 483 L 619 472 L 624 458 L 629 446 L 633 429 L 635 416 L 635 404 L 623 405 L 611 404 L 598 402 L 587 397 L 579 388 L 578 374 L 577 364 L 570 372 L 567 388 L 567 408 L 567 428 L 568 448 L 570 471 L 568 487 Z",
  },
  {
    id: "back-ham-2",
    side: "back",
    group: "hamstrings",
    label: "ham",
    d: "M 685 534 L 677 522 L 672 509 L 668 495 L 665 478 L 661 466 L 656 452 L 652 440 L 648 429 L 647 419 L 647 403 L 657 405 L 669 405 L 682 404 L 692 399 L 701 392 L 705 381 L 705 368 L 711 371 L 715 386 L 715 404 L 715 429 L 714 449 L 713 467 L 714 485 L 718 505 L 709 498 L 703 505 L 699 517 L 697 511 Z",
  },
  {
    id: "back-calfb-1",
    side: "back",
    group: "calves",
    label: "calfb",
    d: "M 563 507 L 563 516 L 562 525 L 558 534 L 553 546 L 549 559 L 547 574 L 547 589 L 545 605 L 544 635 L 544 650 L 542 673 L 542 692 L 545 699 L 552 701 L 559 700 L 566 697 L 569 690 L 571 681 L 575 672 L 570 660 L 565 656 L 571 632 L 578 617 L 583 608 L 587 601 L 593 589 L 594 575 L 594 558 L 598 536 L 592 516 L 585 509 L 583 519 L 575 499 L 568 503 Z",
  },
  {
    id: "back-calfb-2",
    side: "back",
    group: "calves",
    label: "calfb",
    d: "M 713 636 L 706 623 L 699 611 L 693 598 L 688 585 L 687 568 L 688 555 L 685 537 L 691 520 L 697 511 L 700 520 L 706 502 L 707 498 L 718 504 L 718 520 L 723 535 L 731 550 L 734 579 L 738 618 L 739 650 L 739 676 L 739 690 L 737 697 L 728 700 L 719 698 L 713 692 L 709 679 L 707 667 L 711 660 L 718 657 Z",
  },
  {
    id: "back-tricepb-1",
    side: "back",
    group: "triceps",
    label: "tricepb",
    d: "M 533 229 L 539 211 L 543 200 L 550 195 L 557 190 L 564 188 L 569 187 L 572 197 L 574 205 L 577 216 L 574 227 L 572 237 L 567 248 L 560 258 L 553 267 L 543 266 L 543 258 L 547 244 L 547 235 L 544 233 L 539 238 L 538 247 L 537 257 L 533 266 L 528 257 L 528 244 Z",
  },
  {
    id: "back-tricepb-2",
    side: "back",
    group: "triceps",
    label: "tricepb",
    d: "M 707 221 L 711 236 L 716 248 L 723 258 L 728 265 L 738 268 L 738 259 L 735 246 L 735 238 L 738 233 L 742 238 L 743 249 L 745 261 L 748 267 L 752 258 L 755 250 L 752 236 L 748 222 L 740 208 L 735 198 L 728 190 L 721 189 L 712 186 L 707 205 Z",
  },
  {
    id: "back-forearmb-1",
    side: "back",
    group: "triceps",
    label: "forearmb",
    d: "M 485 355 L 491 342 L 494 328 L 498 312 L 504 296 L 512 280 L 519 271 L 527 256 L 533 269 L 536 263 L 537 251 L 540 241 L 544 232 L 548 240 L 545 249 L 543 261 L 543 268 L 551 268 L 551 280 L 544 297 L 532 315 L 520 332 L 510 351 L 505 359 L 493 360 Z",
  },
  {
    id: "back-forearmb-2",
    side: "back",
    group: "triceps",
    label: "forearmb",
    d: "M 775 358 L 768 341 L 761 329 L 752 317 L 745 307 L 739 300 L 734 289 L 732 281 L 729 267 L 738 267 L 738 255 L 735 244 L 737 232 L 741 236 L 744 250 L 747 265 L 749 267 L 755 254 L 764 269 L 777 294 L 786 319 L 791 340 L 797 354 L 787 358 Z",
  },
];
