import React from "react";
import ErrorImg from "@/assets/error-img.svg";
import Link from "next/link";
import Image from "next/image";
function Page() {
    return (
        <div className="no-data-page children-wrapper bg-slate-50 py-14">
            <div className="frl-container ">
                <div className=" flex flex-col items-center justify-center">
                    <Image src={ErrorImg} alt="ErrorImg"
                        className="max-w-64 xl:max-w-80" />
                    <div className="flex flex-col items-center justify-center gap-1">
                        <h2 className="text-center text-4xl lg:text-5xl xl:text-6xl">
                            This page is unavailable.
                        </h2>
                        <p className="max-w-xl text-center text-3xl text-grey">
                            The page you&apos;re looking for isn&apos;t here, but don&apos;t
                            worry, we&apos;ll help you find your way back.
                        </p>
                        <Link href="/" className="mt-5 block">
                            <button
                                className="flex cursor-pointer items-center space-x-2 px-3 py-2 text-amber-50 bg-blue-600 rounded-md"

                            >
                                Go to Dashboard
                            </button>
                        </Link>
                    </div>
                </div>
            </div>
        </div>
    );
}

export default Page;
